# PRD — Email Scheduler ("ONG")

## 1. Goal
A small, reliable email scheduler + Gmail-style dashboard. A signed-in user composes an email (rich text, attachments), adds recipients (typed or CSV/TXT list), schedules it (now or later) with pacing and an hourly cap, and monitors Scheduled / Sent emails. It must survive restarts without losing or duplicating sends.

Principle: **complete, demonstrable, simple. $0 to build and demo.** No microservices, no extra layers, nothing optional until all required features work.

## 2. Hard constraints
- No cron of any kind. Scheduling = BullMQ delayed jobs + startup reconciliation.
- Real Google OAuth, real Slack OAuth + real Slack message, real Ethereal SMTP, real Elasticsearch in the final demo. Mocks only in unit tests.
- PostgreSQL = source of truth. Redis/BullMQ = scheduling. Elasticsearch = rebuildable index.
- Never claim exactly-once SMTP delivery (specs §9).
- No secrets in git. `.env.example` only.
- **Free only, no Docker** (specs §14, §16, §17): native installs or free managed tiers; no paid service.

## 3. Stack (fixed, all free/open-source)
| Layer | Choice |
|---|---|
| Backend | Node 20, TypeScript strict, Express, Zod, Prisma, pino, sanitize-html, multer |
| DB / Queue / Search | PostgreSQL 16 (local install or Neon free), Redis 7 (local install or Redis Cloud free), Elasticsearch 8 (local archive install; optional in deployment) — **no Docker** |
| Queue | BullMQ; Bull Board (`@bull-board/express`) |
| SMTP | Nodemailer → Ethereal (free fake SMTP) |
| Frontend | React + TS + Vite, Tailwind, TanStack Query, react-router, TipTap (rich text), DOMPurify, lucide-react icons |
| Tests | Vitest + supertest |
| Package manager | npm (separate `frontend/` and `backend/`, no workspaces) |
| Deployment (optional) | One free web service serving API + worker + built frontend (specs §17) |

## 4. User stories (all required)
1. Login page with "Login with Google"; after login land on Scheduled list; sidebar shows name/email/avatar; logout.
2. Sidebar: Compose button; Scheduled (count) and Sent (count) navigation.
3. List screens (Scheduled / Sent): Gmail-style rows, search, filter, refresh, pagination, star, loading / empty / error+retry.
4. Click a row → email detail page (sender, recipient, date, rendered HTML body, attachments, status/error).
5. Compose page: From, To (chips + "Upload List"), Subject, Delay between 2 emails, Hourly Limit, rich-text body, attachments (paperclip), Send / Send Later popover.
6. Confirmation summary before scheduling; Send disabled while submitting; form preserved on error; success toast with accepted count.
7. Connect / disconnect Slack (from the user menu); real Slack message when a sender hits its hourly cap.
8. Bull Board access (authenticated, admin only).
9. Stop API + worker, restart: pending emails still send once, on time.

## 5. Functional rules
**Recipients.** Server is authoritative. CSV: header row with `email` column (case-insensitive); fallback = first column whose cells look like emails. TXT: one address per line, blank/`#` lines ignored. Lowercase+trim. Invalid = fails Zod `email()`. Duplicate = repeated within the campaign. Limits: upload ≤ 2 MB, ≤ 5,000 recipients per campaign. Typed and uploaded addresses merge into one set.

**Body.** Rich-text HTML from TipTap, sanitized server-side (allowlist), plain-text alternative generated for SMTP. ≤ 50 KB. No merge tags.

**Attachments.** ≤ 3 files, ≤ 2 MB each, types: png, jpg, gif, webp, pdf, txt, csv. Stored in PostgreSQL (`bytea`) — no object storage needed. Attached to every email of the campaign.

**Scheduling.** Email *i* gets `scheduledAt = startAt + i * delaySeconds`. "Send" = startAt now. "Send Later" = chosen date/time (past values clamp to now). `delaySeconds` 0–3600, `hourlyLimit` 1–1000. At send time:
- spacing = max(delaySeconds·1000, MIN_DELAY_BETWEEN_SENDS_MS)
- sender hourly cap = min(hourlyLimit, MAX_EMAILS_PER_HOUR_PER_SENDER); global cap MAX_EMAILS_PER_HOUR_GLOBAL.

**Cap hit.** Jobs are deferred to the next UTC hour (+ jitter), never dropped. One Slack alert per sender per hour window.

**Senders.** One real Ethereal credential in env. Each user gets 3 sender identities seeded at first login: their Google email, `<local>+sales@<domain>`, `<local>+support@<domain>`; all send through the one credential with a different From. Limits are per sender id.

**Idempotency.** Client sends `Idempotency-Key` (UUID created when Compose opens, reused on retry). Same key + user → original campaign returned, nothing new created.

**Star.** Per-email boolean the user can toggle; filterable.

## 6. Out of scope
Email/password login (design shows it; we ship Google-only), archive/delete, edit/cancel of scheduled mail, templates/merge tags, org multi-tenancy, SSE (use 10 s polling), attempt-history table, dark mode.

## 7. Definition of done
Every item in `build-plan.md` checklist is Implemented, or "blocked by credentials"; README complete; demo video (≤ 5 min) follows `build-plan.md` §5.
