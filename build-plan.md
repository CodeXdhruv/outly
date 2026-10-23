# Build Plan, Checklist, Tests, README & Demo

## 0. Instructions to the coding agent
You are a senior full-stack engineer. Build exactly what `prd.md`, `specs.md`, `design.md` describe. Keep it simple: no extra layers, no extra packages, no speculative features. Use only free tools (specs §16). Follow the screenshots in `docs/figma/` if present, else `design.md`. Keep the app runnable after each phase; commit per phase. If something needs credentials you don't have, implement it fully and mark "blocked by credentials" — never fake it in the real path. Never claim exactly-once delivery. No cron.

## 1. Phases (in order)
1. **Infra & skeleton** — service setup docs (local native or Neon/Redis Cloud; ES optional), `.env.example`, `config.ts`, Prisma schema + migration, Express app with `/health/*`, error middleware, pino, graceful shutdown. Vite + Tailwind boots with tokens and fonts (Inter, pixel font).
2. **Auth + shell** — Google OAuth, Redis sessions, `/api/me`, logout, Origin check, seed 3 senders. Frontend: Login page, auth gate, `AppShell` + `Sidebar` + `UserMenu`.
3. **Lists** — `/api/emails` (Postgres), `/api/emails/counts`, `/api/emails/:id`, `PATCH star`. Frontend: EmailList (Scheduled/Sent), `EmailRow`, `StatusPill`, search, filter popover, refresh, pagination, star, loading/empty/error states, EmailDetail.
4. **Compose & scheduling** — `parseRecipients`, `/api/leads/preview`, `/api/attachments`, `sanitizeBody`, `/api/campaigns` (transaction + idempotency + enqueue). Frontend: Compose page — RecipientInput chips + Upload List, TipTap editor + toolbar, attachments, Send Later popover, ConfirmSendDialog.
5. **Worker** — claim → reserve (Lua) → send (Ethereal, html+text+attachments) → persist; defer via `moveToDelayed`; error classification; `reconcile()` on API + worker start.
6. **Rate-limit hardening** — spacing, per-sender + global caps, release rules, jitter; concurrency tests.
7. **Slack** — signed-state OAuth, encryption, status/disconnect, `notifyLimitHit` dedupe; UserMenu Slack row. Set up the free HTTPS tunnel.
8. **Elasticsearch** — mapping, indexing hooks, search with Postgres fallback, reindex script, startup sweep.
9. **Bull Board** — `/admin/queues` behind auth + `ADMIN_EMAILS`.
10. **Load test & restart test** — `scripts/loadtest.ts` (≥1,000 delayed jobs, no SMTP) and the restart procedure (§6).
11. **Deploy (optional, specs §17) & polish docs** — fidelity pass against screenshots, README, checklist, demo recording.
*If time runs short, cut in this order: filter popover → star → ES-specific filters → attachments. Everything else is required.*

## 2. Requirement checklist (agent maintains; Implemented / Tested / Partial / Blocked-by-credentials)
| # | Requirement | Status |
|---|---|---|
| 1 | Google OAuth (state validated, sessions, logout, user info in sidebar) | |
| 2 | Login page matches design (Google only) | |
| 3 | Sidebar: Compose, Scheduled/Sent with counts, user menu | |
| 4 | List rows (Gmail-style), search, filter, refresh, pagination, star | |
| 5 | Loading / empty / error+retry on lists | |
| 6 | Email detail page (body, attachments, status/error) | |
| 7 | Compose page: From, To chips, Upload List, Subject, Delay, Hourly Limit | |
| 8 | Rich-text editor + toolbar; HTML sanitized server + client | |
| 9 | Attachments (≤3, ≤2 MB, allowlist), sent via SMTP | |
| 10 | Send Later popover + quick options; Send now | |
| 11 | Confirm summary, disabled while submitting, form preserved on error | |
| 12 | Server-side parsing/validation, size & count limits | |
| 13 | Campaign + emails in one DB transaction; idempotency key | |
| 14 | BullMQ delayed jobs, stable job ids, no cron | |
| 15 | Startup reconciliation (idempotent) + restart verified with volumes | |
| 16 | Worker concurrency configurable | |
| 17 | Min delay between sends (shared, per sender) | |
| 18 | Hourly cap per sender + global (Redis Lua, atomic) | |
| 19 | Cap hit → defer to next hour, nothing dropped | |
| 20 | Ethereal SMTP, message id persisted, transient/permanent handling | |
| 21 | Elasticsearch index + user-scoped search + fallback + reindex | |
| 22 | Bull Board protected | |
| 23 | Slack OAuth connect/disconnect/reconnect, encrypted tokens | |
| 24 | Real Slack message on cap hit, deduped per sender+hour | |
| 25 | Slack failure / not connected never blocks sending | |
| 26 | Ownership enforced on every endpoint | |
| 27 | Health endpoints, graceful shutdown, structured logs | |
| 28 | Load test ≥1,000 jobs | |
| 29 | README + demo video | |

## 3. Tests (Vitest; focused)
**Unit:** parseRecipients (CSV header variants, no-header fallback, TXT, invalid, duplicates, limits, BOM/CRLF) · typed+uploaded merge/dedupe · sanitizeBody (strips script/onerror/javascript: links, keeps allowed formatting) · attachment type/size rules (SVG rejected) · scheduledAt calc (`startAt + i·delay`, past clamp) · Lua limiter on real Redis: cap → next hour, spacing → next slot, **50 parallel reserves never exceed cap** · conditional claim (second claim = 0 rows) · error classification · Slack state sign/verify/expiry/one-time nonce · Slack dedupe + not-connected path · encryption round-trip.
**Integration (against local or free managed Postgres/Redis; ES local):** campaigns: auth required, validation, ownership (user B gets 404 on A's email/attachment), same `Idempotency-Key` creates no extra rows · worker e2e with Ethereal (stub transport in CI) persists `sent` + messageId + attachments included · transient failure → rescheduled attempt+1; permanent → failed · 20 jobs at concurrency 5 keep spacing, no double send · ES: search returns only own docs; ES down → API still lists via fallback · reconcile: delete a job from Redis, run reconcile → job back; run twice → no duplicates · loadtest: 1,000 jobs created with bounded concurrency, Redis count = 1,000.
**Manual real demo:** Google login, Ethereal inbox, real Slack message (via tunnel), ES search.

## 4. README must contain (in order)
1 Overview & features · 2 Architecture (specs §2) · 3 Prerequisites (Node 20; Postgres, Redis, optional Elasticsearch — local native installs or Neon/Redis Cloud; free accounts: Google Cloud, Ethereal, Slack; tunnel tool only for local Slack) · 4 Install & run (start Postgres/Redis(/ES) or set Neon/Redis Cloud URLs, `npm i`, `npx prisma migrate deploy`, `npm run dev:api`, `npm run dev:worker`, frontend `npm run dev`) · 5 Env table · 6 Google OAuth setup (consent screen in Testing mode + test user; redirect `http://localhost:4000/auth/google/callback`) · 7 Ethereal setup (fake SMTP, view mail in Ethereal inbox) · 8 Slack setup: create app, scope `incoming-webhook`, **HTTPS redirect: deployed URL, or a free tunnel for local runs** (commands, updating `SLACK_CALLBACK_URL`, restart), how the alert triggers · 9 Elasticsearch & search behavior (+ fallback, reindex) · 10 Running API/worker separately · 11 Tests · 12 Bull Board (`/admin/queues`, `ADMIN_EMAILS`) · 13 Rate-limit design (fixed UTC hour, concurrency, min delay, jitter, trade-offs) · 14 Restart recovery · 15 SMTP exactly-once limitation + trade-offs (one Ethereal credential/multiple identities, no email/password login, no cancel, polling not SSE, ES security off in dev, attachments in Postgres) · 16 Free deployment guide (specs §17: Render + Neon + Redis Cloud, or Oracle VM) · 17 Checklist table · 18 Demo link; repo access for `Mitrajit` and `Yadav036`.

## 5. Demo script (≤5 min)
1. (25s) Login with Google → Scheduled list. 2. (70s) Compose: type two recipients + Upload List (CSV with invalid/duplicate rows), rich text, attach an image, Send Later via popover (+2 min) → confirm → toast. 3. (40s) Row appears in Scheduled with orange time pill, then moves to Sent; open detail; show Ethereal inbox with attachment. 4. (60s) Low hourly limit (e.g. 3) with 10 recipients → Deferred pills + **real Slack message**. 5. (45s) Bull Board. 6. (45s) Restart scenario (§6). 7. (15s) Search by recipient (ES). Optional: loadtest output.

## 6. Restart test procedure
Start Postgres/Redis(/ES) with persistence (`redis-server --appendonly yes`), or use Neon + Redis Cloud → run API + worker → schedule 10 emails 2–3 min out → kill both → wait → start both → reconcile log shows jobs found/republished → all 10 send after due time, `sent` = 10, no duplicates in Ethereal. Never flush Redis or drop the database during this test. (If Redis is non-persistent or was wiped, reconcile still republishes jobs from Postgres — show that too.)
