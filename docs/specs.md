# Technical Specs & Architecture

## 1. Repo layout (do not add folders without need)
```
reachinbox/
├── backend/
│   ├── src/
│   │   ├── index.ts        # API entry: express, middleware, routes, bull-board, health, shutdown, startup reconcile
│   │   ├── worker.ts       # Worker entry: BullMQ worker + send lifecycle
│   │   ├── routes.ts       # REST endpoints
│   │   ├── auth.ts         # Google OAuth, sessions, requireAuth/requireAdmin, origin check
│   │   ├── db.ts           # Prisma client singleton
│   │   ├── queue.ts        # Queue, enqueue, stable job ids, reconcile()
│   │   ├── email.ts        # parseRecipients(), sanitizeBody(), SMTP transport, sendMail(), error classification
│   │   ├── rateLimit.ts    # Lua reservation script + helpers
│   │   ├── slack.ts        # Slack OAuth (signed state), encryption, notify()
│   │   ├── search.ts       # ES mapping, index, search, reindex
│   │   ├── config.ts       # Zod-validated env
│   │   └── scripts/        # reindex.ts, loadtest.ts
│   ├── prisma/schema.prisma (+ committed migrations)
│   ├── tests/
│   └── package.json
├── frontend/ (see design.md)
├── docs/ (prd.md, specs.md, design.md, build-plan.md)
├── .env.example, .gitignore, README.md   (no Docker files)
```
`index.ts` and `worker.ts` are separate processes sharing the same code: `npm run dev:api`, `npm run dev:worker`.

## 2. Architecture
```
Browser ──cookie──> Express API ──> PostgreSQL (truth)
                      │  └──────> BullMQ queue "emails" (Redis)  ──> Worker(s) ──> Ethereal SMTP
                      │                                   │             │──> Redis Lua rate limiter
                      │                                   │             │──> Slack webhook (on cap hit)
                      └──> Elasticsearch (search only)  <─┴─────────────┘ (best-effort indexing)
```
Request path never sends mail. API persists, enqueues delayed jobs, returns.

## 3. Data model (Prisma, PostgreSQL)
```prisma
model User {
  id String @id @default(uuid())
  googleSubject String @unique
  email String
  name String
  avatarUrl String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
model Sender {
  id String @id @default(uuid())
  userId String
  fromEmail String
  enabled Boolean @default(true)
  @@unique([userId, fromEmail])
}
model Campaign {
  id String @id @default(uuid())
  userId String
  senderId String
  subject String
  bodyHtml String           // sanitized, immutable after creation
  bodyText String           // derived plain-text alternative
  startAt DateTime
  delaySeconds Int
  hourlyLimit Int
  status String             // scheduled | completed
  idempotencyKey String
  totalCount Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([userId, idempotencyKey])
  @@index([userId, createdAt])
}
model Attachment {
  id String @id @default(uuid())
  userId String
  campaignId String?        // null until a campaign claims it
  filename String
  mimeType String
  size Int
  data Bytes
  createdAt DateTime @default(now())
  @@index([campaignId])
}
model Email {
  id String @id @default(uuid())
  campaignId String
  userId String
  senderId String
  recipientEmail String
  subject String            // copied for list/search speed
  preview String            // first ~140 chars of body text, for list rows
  scheduledAt DateTime      // UTC; updated when deferred/retried
  sentAt DateTime?
  status String             // scheduled | processing | sent | failed
  starred Boolean @default(false)
  attemptCount Int @default(0)
  deferredCount Int @default(0)
  bullJobId String @unique  // "email_<id>"
  providerMessageId String?
  lastErrorCode String?
  lastErrorMessage String?  // sanitized, <=200 chars
  searchSyncedAt DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([campaignId, recipientEmail])
  @@index([userId, status, scheduledAt])
  @@index([userId, status, sentAt])
  @@index([campaignId]) @@index([senderId])
}
model SlackConnection {
  id String @id @default(uuid())
  userId String @unique
  teamId String
  teamName String
  channel String?
  encryptedWebhookUrl String   // AES-256-GCM
  encryptedAccessToken String
  scope String
  revokedAt DateTime?
  createdAt DateTime @default(now()); updatedAt DateTime @updatedAt
}
model RateLimitEvent {
  id String @id @default(uuid())
  senderId String
  eventType String            // HOURLY_LIMIT_HIT
  hourWindowStart DateTime
  status String               // notified | skipped_no_slack | failed
  createdAt DateTime @default(now())
  @@unique([senderId, eventType, hourWindowStart])
}
```
(Add Prisma `@relation`s as needed.) Body lives once per campaign, not per email — a 5,000-recipient campaign stores one body. Idempotency = `Campaign @@unique([userId, idempotencyKey])` + `Email @@unique([campaignId, recipientEmail])`.

## 4. Email state machine (conditional updates in Postgres)
```
scheduled ──claim──> processing ──ok──> sent
                         │──transient err (attempt<3)──> scheduled (scheduledAt=now+backoff, attemptCount++)
                         │──rate/pace not eligible────> scheduled (scheduledAt=next slot, deferredCount++)
                         └──permanent err or attempts exhausted──> failed
```
Claim = `UPDATE "Email" SET status='processing', attemptCount=attemptCount+1 WHERE id=$1 AND status='scheduled' RETURNING *`. If 0 rows → skip (already sent/processing/failed). Do the rate-limit reservation **before** claim/send (see §6) so deferral doesn't count as an attempt: order = load row → if status≠scheduled skip → reserve → if denied defer → claim → send → persist.
Display mapping: UI "Deferred" badge when `status=scheduled AND deferredCount>0`; "Sending" for `processing`.

## 5. Queue (BullMQ)
- Queue `emails`. Job id: `email_<emailId>` (BullMQ rejects custom ids containing `:`). Job data: `{ emailId }` only; worker always reads the DB.
- Add with `delay = max(0, scheduledAt - now)`, `attempts: 1` (retries are handled by our own logic, not BullMQ retries), `removeOnComplete: {count:200}`, `removeOnFail: {count:200}` (keeps Redis small; matters on a 30 MB free instance).
- Enqueue in bounded chunks: `queue.addBulk` in batches of 500.
- Rescheduling inside the worker: `await job.moveToDelayed(ts, token); throw new DelayedError();` — no sleeping, no new job.
- Worker: `new Worker('emails', processor, { connection, concurrency: WORKER_CONCURRENCY })`. Redis connection `maxRetriesPerRequest: null`.
- **No BullMQ limiter** — rate control is the custom Lua limiter so it is per-sender and shared.

### Reconciliation (`reconcile()` in queue.ts) — run on API start and worker start
Idempotent, safe to repeat, no cron:
1. Select Email where `status='scheduled'` in pages of 500.
2. For each: `queue.getJob(bullJobId)`; if missing, or in state completed/failed → remove if present, then `add` with delay from `scheduledAt`.
3. Select Email where `status='processing' AND updatedAt < now() - 5 min` (worker crashed mid-send) → set back to `scheduled`, re-enqueue. This is at-least-once by design (§9).
4. Sweep ES: rows with `searchSyncedAt IS NULL OR searchSyncedAt < updatedAt` (limit 1000/run) → index.
Residual risk (documented): DB commit succeeded but Redis down at enqueue time → covered by reconcile on next start; between those moments the email is late, not lost.

## 6. Rate limiting (`rateLimit.ts`) — one Redis Lua script, atomic
Window = **fixed UTC calendar hour**. Keys:
- `rl:sent:{senderId}:{hourStartEpoch}` (counter, EXPIRE 2h)
- `rl:global:{hourStartEpoch}` (counter, EXPIRE 2h)
- `rl:next:{senderId}` (next allowed send time, ms; EXPIRE 1h)

`reserve(senderId, senderLimit, spacingMs, now)` returns `{ok:boolean, retryAt:number, reason:'sender_cap'|'global_cap'|'spacing'|null}`:
```
hourStart = floor(now/3600000)*3600000; hourEnd = hourStart+3600000
if GET(sender counter) >= senderLimit  -> {0, hourEnd, 'sender_cap'}
if GET(global counter) >= globalLimit  -> {0, hourEnd, 'global_cap'}
next = GET(rl:next) or 0
if now < next                          -> {0, next, 'spacing'}
INCR both counters (+EXPIRE); SET rl:next = now+spacingMs; -> {1, 0}
```
Worker behavior when `ok=false`: defer to `retryAt + random(0, spacingMs*WORKER_CONCURRENCY)` (jitter avoids thundering herd and keeps rough order), update `Email.scheduledAt`, `deferredCount++`, `moveToDelayed`. **No worker ever sleeps.**
On `reason in (sender_cap, global_cap)` → `slack.notifyLimitHit(...)` (non-blocking, errors swallowed).
Reservation release: if send fails *permanently or transiently before SMTP accepted*, DECR the counters (safe). If outcome is ambiguous (timeout after DATA), do **not** release (conservative).
All numbers from env: `WORKER_CONCURRENCY`, `MIN_DELAY_BETWEEN_SENDS_MS`, `MAX_EMAILS_PER_HOUR_PER_SENDER`, `MAX_EMAILS_PER_HOUR_GLOBAL`. `RATE_LIMIT_TIMEZONE` is fixed to UTC (documented; do not implement other zones).
Under a 1000-job burst: jobs fire, ~cap are sent paced by spacing, the rest are repeatedly deferred to later hour windows; nothing is lost. Trade-off: deferred jobs in the same hour re-contend, order is approximate.

## 7. SMTP, body & attachments (`email.ts`)
- One pooled Nodemailer transport (`pool:true, maxConnections: WORKER_CONCURRENCY`). Headers: `Message-ID: <email-<emailId>@ong.local>`. From = sender.fromEmail. Message = `html: campaign.bodyHtml`, `text: campaign.bodyText`, `attachments` from the campaign's Attachment rows. Persist `providerMessageId`.
- **Worker attachment loading:** per-process `Map<campaignId, {attachments, expires}>` cache (TTL 5 min, max 20 campaigns) so a 5,000-email campaign reads attachments once, not 5,000 times.
- **Sanitization:** `sanitizeBody(html)` using `sanitize-html` allowlist — tags `p br strong em u s h1 h2 h3 ul ol li blockquote a span`; `a[href]` only http/https/mailto; style limited to `text-align`. Applied on campaign creation. The frontend re-sanitizes with DOMPurify before rendering. `bodyText` via `sanitize-html` with no tags allowed + whitespace normalization; `preview` = first 140 chars.
- **Attachment upload rules:** MIME allowlist (png, jpeg, gif, webp, pdf, plain text, csv) checked against both the declared type and file extension; **no SVG/HTML**; ≤2 MB each, ≤3 per campaign. Served with `X-Content-Type-Options: nosniff`; non-image types as `Content-Disposition: attachment`.
- Error classification:
  - Permanent: SMTP 5xx, `EENVELOPE`, invalid address.
  - Transient: `ECONNECTION`, `ETIMEDOUT`, `ESOCKET`, 421/450/451/452.
  - Timeout after message sent → treated transient but may duplicate (§9).
- Retries: max 3 attempts, backoff 30 s, 2 min, 10 min. Stored error message sanitized (no credentials, ≤200 chars).

## 8. Search & list queries (`search.ts`, `routes.ts`)
Index `emails`: `emailId,userId,campaignId,senderId` keyword; `recipientEmail` text + `.keyword`; `subject` text + `.keyword`; `preview` text; `status` keyword; `scheduledAt,sentAt,createdAt` date. Doc `_id = emailId`.
- Index on campaign creation (bulk, best-effort) and after each status change (best-effort, try/catch, then set `searchSyncedAt`). Star changes are **not** indexed.
- List query rules for `GET /api/emails`:
  - No `search` → PostgreSQL only.
  - `search` present and not `starred` → Elasticsearch (`bool.filter`: `term userId`, `terms status`, optional `senderId`, date range; `multi_match` on recipientEmail, subject, preview, with prefix support) → returns ordered ids + total → hydrate rows from PostgreSQL in the same order.
  - `starred=true` → PostgreSQL only (`ILIKE` for search).
  - **Any ES error → fall back to PostgreSQL `ILIKE`.** ES failure never blocks scheduling/sending/listing.
- `npm run reindex` rebuilds the index from PostgreSQL. Startup sweep (in reconcile) indexes rows where `searchSyncedAt IS NULL OR < updatedAt` (≤1000 per run).

## 9. Idempotency & the SMTP limitation
Layers: stable email UUID; deterministic job id; `Idempotency-Key` on campaign; unique(campaignId, recipientEmail); conditional claim UPDATE; skip if not `scheduled`; Message-ID derived from email id.
**Limitation (put in README):** if SMTP accepts a message and the process dies before `status='sent'` is written, recovery resets the row and it may be sent twice. Exactly-once across SMTP + DB is impossible without provider-side dedupe. We minimize the window (write `sent` immediately after `sendMail` resolves) and document it.

## 10. Auth (`auth.ts`)
- Google OAuth2 authorization-code flow via `google-auth-library`. `state` random, stored in session, verified on callback. Scopes: `openid email profile`. Upsert User by `googleSubject`; seed 3 senders on first login. Redirect to `WEB_ORIGIN/`.
- Sessions: `express-session` + `connect-redis`; cookie `httpOnly`, `sameSite:'lax'`, `secure` in production, 7-day maxAge, `sid` regenerated on login.
- CSRF: for POST/DELETE require `Origin` (or Referer) to equal `WEB_ORIGIN`; reject otherwise. Combined with SameSite=Lax this is sufficient for this app (documented).
- In dev, frontend uses Vite proxy `/api`, `/auth`, `/integrations`, `/admin` → API origin so cookies are same-site.
- Every query includes `userId` from the session. 404 (not 403) for other users' records.
- Bull Board at `/admin/queues`: `requireAuth` + email must be in `ADMIN_EMAILS` (comma-separated env).

**Production serving (single origin).** In production the API also serves the built frontend (`express.static('frontend/dist')` + SPA fallback for non-`/api|/auth|/integrations|/admin|/health` paths). One origin ⇒ session cookie works (`SameSite=Lax`), no CORS, and `WEB_ORIGIN == API_ORIGIN`. Set `app.set('trust proxy', 1)` and `cookie.secure = true` when `NODE_ENV=production` (hosts terminate TLS at a proxy).

**Run modes.** `npm run dev:api` / `npm run dev:worker` (separate processes, local). `npm run start:all` (production on one free instance): `index.ts` also starts the worker in-process when `RUN_WORKER=true`; shutdown closes both. `worker.ts` exports `startWorker()` and still runs standalone.

## 11. Slack (`slack.ts`)
- **Slack requires HTTPS redirect URLs; `http://localhost` is rejected** (verified in Slack docs/community reports). So `SLACK_CALLBACK_URL` must be HTTPS: the deployed URL (§17) when deployed, or a free tunnel URL pointing at the local API when running locally (§16). When using a tunnel, only the Slack callback goes through it; everything else stays on localhost.
- Because the callback arrives on a different host than the session cookie, **do not rely on the session for `state`**. State = `base64url(payload).HMAC_SHA256(SESSION_SECRET)` where payload = `{userId, nonce, exp(10 min)}`; nonce stored in Redis (`slack:nonce:<nonce>`, TTL 10 min) and **deleted on first use** (one-time). Callback verifies signature, expiry, nonce → then knows the user. After saving, redirect to `WEB_ORIGIN/scheduled?slack=connected` (or `?slack=error`); the user's localhost cookie is still valid.
- Scope: **`incoming-webhook`** only (user chooses the channel in Slack's consent screen). Authorize URL `https://slack.com/oauth/v2/authorize?client_id&scope=incoming-webhook&redirect_uri&state` (scopes comma-separated if more are ever added). Exchange at `https://slack.com/api/oauth.v2.access` with the **same** `redirect_uri`. Store `team.id`, `team.name`, `incoming_webhook.url`, `incoming_webhook.channel`, `access_token`; webhook URL and token AES-256-GCM encrypted with `TOKEN_ENCRYPTION_KEY` (32-byte base64). Never returned to the frontend, never logged.
- `notifyLimitHit({senderId, fromEmail, limit, retryAt})`: find owner's non-revoked connection → insert `RateLimitEvent` (unique sender+type+hour; on unique violation stop = dedupe) → POST to webhook. No connection → record `skipped_no_slack`, return. HTTP 404/403 or `invalid_token`/`channel_not_found`/`no_service` → set `revokedAt`, status `failed` (UI shows Reconnect). Everything wrapped; failures never affect delivery.
- Message: `:warning: Hourly limit reached for sender <from> (<limit>/hour). Remaining emails are deferred to <HH:mm UTC>.`
- Disconnect deletes the row. Reconnect = connect again (upsert). No redeploy.

## 12. API (JSON unless stated; errors `{error:{code,message}}`; Zod validation; central error middleware; `express.json({limit:'1mb'})`)
| Method | Path | Notes |
|---|---|---|
| GET | /auth/google, /auth/google/callback | OAuth |
| POST | /auth/logout | destroy session |
| GET | /api/me | `{id,email,name,avatarUrl,isAdmin}` or 401 |
| GET | /api/senders | `[{id,fromEmail}]` |
| POST | /api/leads/preview | multipart `file` (CSV/TXT) → `{filename, emails:string[] (valid, unique), valid, invalid, duplicates, samples:[{row,value,reason}] (≤5)}` |
| POST | /api/attachments | multipart `file` (one) → `{id,filename,size,mimeType}` (unclaimed until a campaign uses it) |
| GET | /api/attachments/:id | owner only; inline for images, download otherwise |
| POST | /api/campaigns | JSON `{senderId, recipients:string[], subject, bodyHtml, startAt(ISO), delaySeconds, hourlyLimit, attachmentIds:string[]}` + header `Idempotency-Key`. Server re-validates/dedupes recipients, sanitizes body, verifies attachment ownership. → 201 `{campaignId, accepted, invalid, duplicates, status}`; repeat key → 200 original |
| GET | /api/emails | `?status=scheduled\|sent&search=&senderId=&from=&to=&starred=&page=1&limit=20` (limit ≤100). `scheduled` = scheduled+processing; `sent` = sent+failed → `{items,page,limit,total}` |
| GET | /api/emails/counts | `{scheduled, sent}` for the sidebar |
| GET | /api/emails/:id | owner only (404 otherwise): list fields + `bodyHtml`, `fromEmail`, `attachments:[{id,filename,size,mimeType}]`, `attemptCount`, `errorMessage` |
| PATCH | /api/emails/:id | `{starred:boolean}` |
| GET | /integrations/slack/connect, /integrations/slack/callback | OAuth (callback via HTTPS tunnel) |
| GET | /api/integrations/slack | `{connected, teamName?, channel?, revoked?}` |
| DELETE | /api/integrations/slack | disconnect |
| GET | /health/live, /health/ready | ready = DB + Redis (ES reported, non-fatal) |
| — | /admin/queues | Bull Board (auth + admin) |
List item: `{id, recipientEmail, subject, preview, scheduledAt, sentAt, status, deferred:boolean, starred, senderEmail}`. Timestamps ISO-8601 UTC. Scheduled sort: `scheduledAt asc`; Sent sort: `sentAt desc`.
Campaign creation: one Prisma transaction (`campaign.create`, `email.createMany`, `attachment.updateMany` set campaignId) → enqueue (`addBulk` ×500) → best-effort index.
Startup (API) also deletes unclaimed attachments older than 24 h (no cron).

## 13. Config (`config.ts`, Zod; fail fast)
Env: NODE_ENV, PORT=4000, WEB_ORIGIN=http://localhost:5173, API_ORIGIN=http://localhost:4000, DATABASE_URL (pooled), DIRECT_URL (non-pooled, for Prisma migrations; same as DATABASE_URL locally), REDIS_URL (`redis://` or `rediss://`), **ELASTICSEARCH_URL (optional — if unset, search uses the PostgreSQL fallback and logs it once)**, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, SESSION_SECRET, SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_CALLBACK_URL (**must be HTTPS**: deployed URL, or a tunnel URL when running locally), TOKEN_ENCRYPTION_KEY, ETHEREAL_HOST, ETHEREAL_PORT, ETHEREAL_USER, ETHEREAL_PASS, WORKER_CONCURRENCY=5, MIN_DELAY_BETWEEN_SENDS_MS=2000, MAX_EMAILS_PER_HOUR_PER_SENDER=100, MAX_EMAILS_PER_HOUR_GLOBAL=200, RATE_LIMIT_TIMEZONE=UTC (fixed), ADMIN_EMAILS, MAX_RECIPIENTS=5000, MAX_UPLOAD_BYTES=2097152, RUN_WORKER=false.
Prisma datasource uses `url = env("DATABASE_URL")` and `directUrl = env("DIRECT_URL")`.
**Redis connection budget (free Redis allows ~30 connections, ~100 ops/s):** one shared ioredis for sessions + rate limiter + nonces; BullMQ Queue (1) + Worker (2) connections; Bull Board reuses the Queue. Stay under ~8 total. BullMQ connections use `maxRetriesPerRequest: null`. On startup log the Redis `maxmemory-policy`; BullMQ expects `noeviction` — if the provider uses another policy, note it in README.

## 14. Infrastructure without Docker
Three services are needed. For each, pick **local** or **managed free** (both documented in the README; the app only reads URLs from env):
| Service | Local (no Docker) | Managed free |
|---|---|---|
| PostgreSQL 16 | Native install (macOS: Homebrew; Linux: apt; Windows: official installer or WSL2) | Neon free |
| Redis 7 | Native install (macOS Homebrew, Linux apt, Windows via WSL2); run with `redis-server --appendonly yes` so delayed jobs survive restarts | Redis Cloud free |
| Elasticsearch 8 | Download the archive from elastic.co (tar.gz/zip) and run `bin/elasticsearch` with `discovery.type: single-node`, `xpack.security.enabled: false`, heap 512 MB (`jvm.options.d/heap.options`: `-Xms512m` `-Xmx512m`). Needs ~2 GB free RAM. Dev-only security simplification, documented. | **None permanent and free found** (see §16) |
Fastest path with least local installs: Neon + Redis Cloud for dev, and install only Elasticsearch locally (or skip it until phase 8; the app works with the Postgres search fallback).

## 15. Quality rules
Strict TS; structured JSON logs (pino) with requestId/emailId/campaignId/jobId; never log tokens, passwords, bodies; graceful shutdown closes HTTP server, worker (`worker.close()`), queue, Redis, Prisma, ES; Prisma/Redis/ES/SMTP clients are singletons; no N+1 in worker (one `findUnique` with `include sender`); comments only on non-obvious reliability decisions; minimal dependencies.
## 16. Free-only stack ($0)
Status checked October 2026 from vendor/third-party pages; **re-verify before relying on any of it**, free tiers change.
| Need | Free option | Catch |
|---|---|---|
| Postgres | **Neon free**: 0.5 GB/project, 100 compute-hours/month, no card, auto-suspends after ~5 min idle | Don't ping the DB 24/7 (would burn compute-hours) — keep-alive pings must hit `/health/live`, not `/health/ready`. Use the pooled URL for the app, direct URL for migrations. |
| Postgres (avoid) | Supabase free pauses after ~1 week idle; Render free Postgres expires after 30 days | A paused/expired DB would silently stop scheduled sends. |
| Redis | **Redis Cloud free**: 30 MB, ~30 connections, ~100 ops/s, no card | Tiny but enough for sessions + a few thousand delayed jobs; run the 1,000-job load test paced (batches of ≤100) so it doesn't hit the ops/s cap. |
| Redis (avoid for BullMQ) | Upstash free: 500K commands/month | Metered per command; BullMQ's constant polling can exhaust it (our estimate — verify). Render's free Key Value is 25 MB and **not persistent** (recovery still works via reconcile, but use Redis Cloud). |
| Elasticsearch | Self-hosted only (free, unlimited). Elastic Cloud has only a 14-day trial; no permanent free managed tier found | Demo ES locally or on an Oracle VM; deployed-on-Render runs on the Postgres fallback unless `ELASTICSEARCH_URL` is set. |
| Google OAuth | Free; consent screen in Testing mode + test users | Add `https://<deployed-host>/auth/google/callback` once deployed. |
| SMTP | Ethereal | Fake inbox only. |
| Slack | Free workspace + app | HTTPS redirect required: deployed URL works directly; locally use a free tunnel (Cloudflare quick tunnel or ngrok free). |
| Frontend hosting | Served by the same Express service (§10) | No separate host, no CORS/cookie issues. |
| Misc | TipTap, Bull Board, lucide, Google Fonts (OFL), OBS/Loom free for video | |

## 17. Free backend deployment (optional — the assignment only needs repo + README + video)
**Recommendation by situation**
| Option | Fits when | Why / catches |
|---|---|---|
| **A. Render free web service + Neon + Redis Cloud (+ uptime pinger)** | No credit card; fastest to ship | One free web service runs API + worker + frontend (`start:all`). Free web services sleep after 15 min without inbound traffic and take ~1 min to wake, so a sleeping instance would **not** fire delayed jobs; keep it awake with a free external uptime monitor (e.g. UptimeRobot) hitting `/health/live` every ≤10 min. 750 free instance-hours/month ≈ one always-on service; 512 MB RAM / 0.1 CPU; no free background workers (hence in-process worker). Render's free Postgres (30-day expiry) and Key Value (non-persistent) are **not** used. The pinger is infrastructure keep-alive only — scheduling still uses BullMQ delayed jobs, no cron. Confirm Render's current terms. |
| **B. Oracle Cloud Always Free Arm VM** | You have a card for identity verification and are comfortable with Linux | Only permanent free option with real resources (reported 2 Arm OCPU / 12 GB after a mid-2026 reduction); can host API+worker (pm2/systemd), Redis, **and Elasticsearch** (so search is real in production). Catches: capacity is sometimes unavailable, idle instances may be reclaimed, you manage the OS, TLS needs a domain or a Cloudflare tunnel. |
| Not recommended | Fly.io (no free tier for new accounts), Koyeb (free plan removed/card hold since Feb 2026), Railway (small monthly credit after trial), Google Cloud Run (scales to zero, CPU only during requests, so the worker stalls), Cloudflare Workers (no BullMQ/Node runtime) | |
**Render setup (Option A)**
- Web Service from the GitHub repo, root `backend`, Node 20. Build: `npm ci && npx prisma generate && npm run build:all && npx prisma migrate deploy` (`build:all` builds the frontend into `frontend/dist` and compiles the backend). Start: `npm run start:all`. Health check path: `/health/live`.
- Env: everything in §13, with `NODE_ENV=production`, `RUN_WORKER=true`, `WEB_ORIGIN=API_ORIGIN=https://<service>.onrender.com`, `GOOGLE_CALLBACK_URL=https://<service>.onrender.com/auth/google/callback`, `SLACK_CALLBACK_URL=https://<service>.onrender.com/integrations/slack/callback` (add both to the Google/Slack app settings). `ELASTICSEARCH_URL` unset unless you host ES.
- Restart demo on Render: use "Manual deploy → restart"; startup `reconcile()` republishes any missing jobs from Postgres, so delayed emails still send once, on time.
- Free-tier limits to remember: Neon 0.5 GB (attachments live in Postgres — keep the 3 × 2 MB cap), Redis Cloud 30 MB, Render 512 MB RAM.
