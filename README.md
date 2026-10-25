# Outly Email Scheduler ("ONG")

High-reliability email scheduler and Gmail-style campaign management dashboard.
Built with Node 20, TypeScript, Express, Prisma, BullMQ, Redis, PostgreSQL, and React (Vite + Tailwind).

---

## 1. Overview & Features

- **Google OAuth 2.0:** Secure login and session handling via Redis.
- **Gmail-Style Outbox Dashboard:** Scheduled & Sent lists with live search, filtering, star toggles, status pills, and detail view.
- **Live Activity & Notification Center:**
  - Header notification bell with real-time activity feed.
  - Monitors campaign creation, completions, failed email deliveries with error reasons, and hourly rate-limit events.
  - Auto-polling background updates with visual unread indicators.
- **Rich Campaign Compose:**
  - TipTap WYSIWYG editor with strict server-side sanitization (`sanitize-html`).
  - Recipient chip inputs + CSV / TXT list uploads with duplicate and invalid email handling.
  - Attachment support (PNG, JPG, GIF, WebP, PDF, TXT, CSV) up to 2 MB each, stored directly in PostgreSQL `bytea`.
  - Pacing delay configuration and hourly rate caps.
  - Send Now or Send Later (with UTC scheduling & quick options).
  - Campaign summary confirmation dialog before enqueuing.
- **High-Reliability BullMQ Worker:**
  - Zero cron dependencies; delayed BullMQ jobs with stable deterministic job IDs.
  - Shared atomic Lua rate limiting across multiple worker instances (hourly limits, spacing, global caps).
  - Rate-limit exceed handling: defer to next UTC hour with jitter (nothing lost or dropped).
  - Startup reconciliation (`reconcile()`): scans Postgres for missing or crashed jobs and re-publishes them safely.
  - Real Ethereal SMTP delivery with error classification (transient retry backoff vs permanent fail).
- **Slack Alerting:**
  - Signed-state Slack OAuth integration with AES-256-GCM encrypted webhooks.
  - Automatic rate-limit alert notifications in Slack when hourly cap is hit (deduplicated per sender per hour).
- **Elasticsearch & OpenSearch Cloud Search:**
  - Full-text multi-match indexing on recipients, subject, and preview with automated PostgreSQL `ILIKE` fallback if Elasticsearch is offline.
  - Compatible with local Elasticsearch clusters and cloud providers like Bonsai.io / OpenSearch.
- **Bull Board Queue Admin:**
  - Protected admin dashboard at `/admin/queues` for monitoring queue states.

---

## 2. Architecture

```text
Browser ──cookie──> Express API ──> PostgreSQL (source of truth)
                      │  └──────> BullMQ queue "emails" (Redis)  ──> Worker(s) ──> Ethereal SMTP
                      │                                   │             │──> Redis Lua rate limiter
                      │                                   │             │──> Slack webhook (on cap hit)
                      │                                   └──> Elasticsearch (search only)
```

---

## 3. Prerequisites

- **Node.js**: v20 or later
- **PostgreSQL**: 16+ (local native install or Neon free tier)
- **Redis**: 7+ (local native install or Redis Cloud free tier)
- **Elasticsearch**: 8+ (optional local archive; automatic PostgreSQL fallback when omitted)

---

## 4. Install & Run

### 1. Configure Backend Environment
```bash
cd backend
cp .env.example .env
# Edit .env with your PostgreSQL, Redis, Google OAuth, and Slack keys
npm install
npx prisma migrate dev --name init
```

### 2. Configure & Build Frontend
```bash
cd ../frontend
npm install
npm run build
```

### 3. Run Development Services
Terminal 1 (API Server):
```bash
cd backend
npm run dev:api
```

Terminal 2 (BullMQ Worker):
```bash
cd backend
npm run dev:worker
```

Terminal 3 (Vite Frontend):
```bash
cd frontend
npm run dev
```

*(Or run production combined service: `npm run start:all` inside `backend/` with `RUN_WORKER=true`)*

### 4. Optional: Elasticsearch Reindexing
If you have configured `ELASTICSEARCH_URL` (local or hosted like Bonsai):
```bash
npm --prefix backend run reindex
```
This syncs all existing database emails into the Elasticsearch index.

---

## 5. Environment Variables (`.env`)

| Variable | Description |
|---|---|
| `PORT` | API Port (default `4000`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `DIRECT_URL` | Direct connection for Prisma migrations |
| `REDIS_URL` | Redis connection URL |
| `ELASTICSEARCH_URL` | Optional Elasticsearch node URL |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials |
| `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` | Slack OAuth credentials |
| `SLACK_CALLBACK_URL` | HTTPS Slack OAuth callback URL |
| `TOKEN_ENCRYPTION_KEY` | 32-byte base64 encryption key for Slack tokens |
| `ETHEREAL_USER` / `ETHEREAL_PASS` | Optional Ethereal credentials (auto-created if empty) |
| `WORKER_CONCURRENCY` | BullMQ worker concurrency (default `5`) |
| `MIN_DELAY_BETWEEN_SENDS_MS` | Minimum spacing between emails (default `2000`) |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Sender cap (default `100`) |
| `MAX_EMAILS_PER_HOUR_GLOBAL` | Global cap (default `200`) |
| `ADMIN_EMAILS` | Comma-separated admin emails for Bull Board |

---

## 6. Restart & Crash Recovery Verification

Pending emails will survive crashes and restarts without duplication:
1. Schedule a campaign with delayed emails.
2. Terminate the API and Worker processes (`kill` or `Ctrl+C`).
3. Restart both processes (`npm run dev:api` and `npm run dev:worker`).
4. On startup, `reconcile()` queries Postgres for all `scheduled` or crashed `processing` emails, verifies their status in BullMQ, and re-enqueues any missing jobs.
5. All emails are dispatched on their scheduled time.

---

## 7. Requirement Checklist

| # | Requirement | Status |
|---|---|---|
| 1 | Google OAuth (state validated, sessions, user info in sidebar) | Implemented |
| 2 | Login page matches design (Google only) | Implemented |
| 3 | Sidebar: Compose, Scheduled/Sent with counts, user menu | Implemented |
| 4 | List rows (Gmail-style), search, filter, refresh, pagination, star | Implemented |
| 5 | Loading / empty / error+retry on lists | Implemented |
| 6 | Email detail page (body, attachments, status/error) | Implemented |
| 7 | Compose page: From, To chips, Upload List, Subject, Delay, Hourly Limit | Implemented |
| 8 | Rich-text editor + toolbar; HTML sanitized server + client | Implemented |
| 9 | Attachments (≤3, ≤2 MB, allowlist), sent via SMTP | Implemented |
| 10 | Send Later popover + quick options; Send now | Implemented |
| 11 | Confirm summary, disabled while submitting, form preserved on error | Implemented |
| 12 | Server-side parsing/validation, size & count limits | Implemented |
| 13 | Campaign + emails in one DB transaction; idempotency key | Implemented |
| 14 | BullMQ delayed jobs, stable job ids, no cron | Implemented |
| 15 | Startup reconciliation (idempotent) + restart recovery | Implemented |
| 16 | Worker concurrency configurable | Implemented |
| 17 | Min delay between sends (shared, per sender) | Implemented |
| 18 | Hourly cap per sender + global (Redis Lua, atomic) | Implemented |
| 19 | Cap hit → defer to next hour, nothing dropped | Implemented |
| 20 | Ethereal SMTP, message id persisted, transient/permanent handling | Implemented |
| 21 | Elasticsearch index + fallback to PostgreSQL | Implemented |
| 22 | Bull Board protected | Implemented |
| 23 | Slack OAuth connect/disconnect, AES-256-GCM tokens | Implemented |
| 24 | Real Slack message on cap hit, deduped per sender+hour | Implemented |
| 25 | Slack failure / not connected never blocks sending | Implemented |
| 26 | Ownership enforced on every endpoint | Implemented |
| 27 | Health endpoints, graceful shutdown, structured logs | Implemented |
| 28 | Load test ≥1,000 jobs | Tested & Passed |
| 29 | Comprehensive README | Implemented |
