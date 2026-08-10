# Embroidery Factory Management SaaS — Development Pipeline

Built from `Saad Sultan's Copy of Embroidery Factories Saas - July 2026.docx` (scope) and `Embroidery-SaaS-Design-Brief.xlsx` (107 screens). This is the build order: what to do first, what depends on what, and where Stage 1 ends.

---

## 1. Stack (locked in)

**Why FastAPI over NestJS for this project specifically:** both are equally capable — this isn't a case where one is objectively better. But two things tip it for this particular product: it's print-heavy (invoices, challans, statements, salary slips, monthly archives all need clean A4 PDFs), and WeasyPrint (HTML/CSS → PDF) is a genuinely better tool for that than anything in the Node ecosystem. And the scheduled weekly/monthly email reports + threshold notifications are exactly Celery Beat's use case, which is more mature for cron-style recurring jobs than BullMQ. The one thing you give up is automatic end-to-end TypeScript type sharing between frontend and backend — mitigated below by generating a typed client from FastAPI's OpenAPI spec. If your own Python fluency is weaker than your TypeScript fluency, that's reason enough to stay with NestJS instead; the frameworks are otherwise a wash for this build.

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14+ (TypeScript, App Router) | Desktop-first + responsive, deploys natively to Vercel |
| Backend | FastAPI (Python 3.12) | Async, Pydantic schemas ≈ Nest DTOs, auto-generated OpenAPI spec |
| ORM | SQLAlchemy 2.0 + Alembic | Type-safe models, migrations, works cleanly with Postgres RLS |
| Database | PostgreSQL, Row-Level Security for tenant isolation | Doc's own non-negotiable — `tenant_id` on every table, RLS enforces it at the DB layer |
| DB hosting | Neon or Supabase (managed Postgres) | Branching for dev/staging, generous free tier, easy from a single dev |
| File storage | Cloudflare R2 or Supabase Storage | Design images, embroidery files, generated PDFs |
| Background jobs | Celery + Redis (Celery Beat for scheduling) | Weekly/monthly email reports, low-stock threshold checks |
| Email | Resend (Python SDK) | Scheduled report emails, password resets |
| PDF generation | WeasyPrint (HTML/CSS → PDF) | Invoices, challans, statements, salary slips — all A4, print-quality |
| Auth | FastAPI + PyJWT (access/refresh), `pyotp` for TOTP MFA | Full control over session expiry, MFA-for-Super-Admins, login history |
| Frontend hosting | **Vercel** (as you specified) | Next.js app only |
| Backend hosting | **Railway** (recommended) | FastAPI + Celery worker/beat + Redis need long-running processes and cron — Vercel serverless functions time out too fast for PDF generation and scheduled jobs. Railway also hosts your Redis instance if you don't use Upstash. |
| Git / deploys | Claude Code | You drive `git` and `vercel` CLI through Claude Code as planned |

**Repo layout** (Next.js frontend in one workspace, Python backend as a separate project in the same repo — Turborepo only manages the JS side):
```
/apps
  /web      → Next.js frontend (Vercel)
  /api      → FastAPI backend, own pyproject.toml/uv.lock (Railway)
  /worker   → Celery worker + Celery Beat scheduler (Railway)
/packages
  /types    → TS types for the frontend, generated from the FastAPI OpenAPI spec (via `orval` or `openapi-typescript`)
  /ui       → Shared React components
```

---

## 2. Local Development Setup

1. `npx create-turbo@latest` for `apps/web` + `packages/*`; `apps/api` and `apps/worker` are separate Python projects (`uv init` or Poetry) living in the same git repo.
2. `docker-compose.yml` in repo root running local Postgres + Redis (mirrors production so RLS behaves identically locally).
3. `apps/api`: FastAPI project, SQLAlchemy + Alembic installed, `.env` with `DATABASE_URL` pointing at local Docker Postgres.
4. `apps/web`: Next.js project, `.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:8000`.
5. `uv sync` in `apps/api`, `pnpm install` in `apps/web`, `docker compose up -d`, `alembic upgrade head`, then run both dev servers (`uvicorn app.main:app --reload` and `pnpm dev`) — a root `Makefile` or `Procfile` can start both with one command.
6. Seed script (`apps/api/app/seed.py`): one demo factory, one branch, a Super Admin user, a few machines/employees/parties — so every screen has data to render against from day one.

This setup is Phase 0 below — do it before writing any feature code.

---

## 3. Development Pipeline

Five phases, same order the scope doc's own "Suggested Development Releases" (§29) lays out — it's already correctly sequenced, so this just makes each release concrete and buildable. Each phase ends with a deploy to Vercel + Railway so you're never more than a couple weeks from a working, demoable app.

### Phase 0 — Bootstrap (foundation before foundation)
1. Repo scaffold (Next.js in `apps/web`, FastAPI in `apps/api`, Celery worker in `apps/worker`) — as above.
2. Docker Compose for local Postgres + Redis.
3. SQLAlchemy models + first Alembic migration: `Tenant`, `User`, `Role`, `Permission` tables only.
4. Railway project created (API + Redis); Vercel project created (web) — deploy a "hello world" from both to prove the pipeline end-to-end before building features.
5. GitHub repo initialized, `main`/`dev` branches, connect Vercel to `apps/web`, connect Railway to `apps/api` via GitHub integration.
6. **Checkpoint:** empty app live on a Vercel URL, API live on a Railway URL, both talking to the same cloud Postgres.

### Phase 1 — Foundation (Release 1)
*Screens: #1–16, 91–98 (Auth, Onboarding wizard, Company/User/Role settings, base Dashboard shell)*

1. SQLAlchemy models (Alembic migration) for core entities: `Factory`, `Branch`, `Party`, `Supplier`, `Machine`, `Employee`, `AuditLog`.
2. Postgres RLS policies keyed on `tenant_id`; FastAPI dependency that runs `SET LOCAL app.tenant_id` per request from the authenticated user's session.
3. Auth module: login, forgot password, JWT access/refresh, session expiry, 2FA (TOTP via `pyotp`) for Super Admins, login history.
4. Roles & permissions engine: role templates + per-user overrides, per-module view/create/edit/approve/see-money/export matrix.
5. Onboarding wizard (Create Company → Add Branch → Add Machines → Add Employees → Import Clients → Import Suppliers → Opening Balances → Initial Inventory → Approval Rules → Report Recipients).
6. Base navigation shell + permission-gated menu + empty Dashboard (cards wired to zeros — real data comes in later phases).
7. Generate the typed frontend API client from FastAPI's OpenAPI spec (`orval` or `openapi-typescript`) and wire it into `packages/types` — do this now so every later phase's frontend work has typed calls from the start.
8. Audit trail: dependency/interceptor that logs every create/update/approve/reject with old/new values.
9. Parties & Suppliers CRUD (list, create/edit, profile — ledger view comes in Phase 3).
10. **Checkpoint:** you can register a factory, add branches/machines/employees/parties, log in with roles, and see permission-gated navigation — deployed and testable on the live URLs.

### Phase 2 — Lot & Production Operations (Release 2)
*Screens: #22–42*

1. `Lot`, `LotColour`, `LotComponent` schema — auto-generation logic for expected components from suit count (with sleeve-pairs handled correctly).
2. Lot List, Create Lot, Colour Breakdown, Component Confirmation, Lot Detail.
3. `Design`, `DesignVariant` schema (master number + component letter + colour-variant code).
4. Design Library, Add Finalized Design, Component & Colour-Scheme Variants, Design Detail.
5. `ProductionJob` schema + proportional colour-allocation logic (auto-split, user-editable).
6. Job List, Create Job, Colour Allocation, Component Status Board (with shirt roll-up logic: complete only when front+back+sleeves are all complete), Job Detail.
7. `MachineProductionEntry` schema — multiple entries per machine+shift, auto-populates both machine history and operator/helper profile (single source of truth, no double entry).
8. Daily Shift Screen (mobile-friendly), Add Production Entry, Production Approval Queue.
9. Machine Performance View, Employee Performance View (with the "% of total production" top-of-page charts from the design brief).
10. **Checkpoint:** a lot can be received, colour/component-confirmed, allocated to a design, turned into a job, and machine production logged against it — full operational chain works end to end.

### Phase 3 — Delivery & Finance (Release 3)
*Screens: #43–58, 20–21, 55–56*

1. `DeliveryChallan` schema — separate delivery units (complete shirt / dupatta / trouser only), cumulative reconciliation (received/delivered/remaining, colour-wise).
2. Delivery List, Create Delivery Challan, Challan Print View (A4).
3. `Invoice`, `InvoiceLineItem` schema — per-suit and stitch-based pricing, using the design's stitch count (never the machine-reported count).
4. Invoice List, Invoice Builder, Invoice Print Preview.
5. `Payment`, `PaymentAllocation` schema — against one invoice, split across many, general against balance, advance, unallocated.
6. Payment List, Payment Entry, Payment Allocation screen.
7. Party Ledger (running debit/credit, append-only, reversal-only corrections) + Statement Print View.
8. `Purchase` schema, Supplier Ledger + Statement Print View, Purchase List/Entry — purchases update inventory (link forward to Phase 4).
9. Expense schema + Expense List/Entry.
10. **Checkpoint:** full money loop works — invoice → payment → ledger balance updates correctly, statements print, supplier payables track the same way.

### Phase 4 — Inventory & Payroll (Release 4)
*Screens: #59–73*

1. `InventoryItem`, `StockTransaction` schema (whole-unit only, no partial cones) — every movement is a mandatory transaction row.
2. Inventory Dashboard, Item List, Add/Edit Item, Stock Transaction (issue/receipt/adjustment).
3. Minimum-threshold logic → auto-populate Purchase Required with its status pipeline (Purchase Required → Pending Approval → Approved → Ordered → Purchased → Received).
4. Low Stock View, Purchase Required View, in-app notification on threshold breach.
5. `Payroll`, `Bonus`, `Deduction`, `Advance` schema — advance balances carry forward automatically until recovered.
6. Monthly Payroll run, Employee Salary Profile, Add Bonus/Deduction/Advance, Advance Installment History, Salary Slip (print), Payroll Approval.
7. **Checkpoint:** stock issued against a job decrements correctly, low stock triggers Purchase Required, and a full month's payroll (with bonuses/deductions/advances) calculates and prints correctly.

### Phase 5 — Reports, SaaS Admin, Hardening & Launch (Release 5)
*Screens: #74–90, 99–107*

1. Machine Detail/Profitability (computed report, not a stored ledger — equal overhead split across active machines in Stage 1).
2. Reporting: Report Library, Financial Reports, Production Reports, Inventory Reports, Machine Reports, Receivable/Payable Ageing — shared filter+chart+table layout, PDF/Excel export on all of them.
3. Approvals Centre (single queue across all pending types), Notifications Centre.
4. Scheduled Report Settings + Celery Beat job that runs weekly/monthly, builds the PDF (WeasyPrint), sends via Resend.
5. Settings: Company Profile, User Management, Roles & Permissions UI, Approval Configuration, Branch Settings, Document Numbering, Notification/Email Settings, Security Settings.
6. Factory-facing Subscription/Billing screen.
7. **Platform Super Admin portal** — separate app area/route group with its own auth boundary: Platform Dashboard, Subscriber Factories (with logged, time-limited support access — never casual data browsing), Subscription Plans, Platform Billing, Trial Accounts, Support Requests, System Health & Backups, Platform Settings.
8. Security hardening pass: rate limiting, encrypted backups + retention policy, file-upload validation, dependency/vuln scan, confirm HTTPS/TLS + encryption-at-rest on the hosting providers, finalize the "even we can't casually see tenant data" support-access model (§24 of the scope doc — decide this explicitly before calling it done, not as an afterthought).
9. Load-test the ledger and stitch-billing calculations specifically — the doc calls this out as where trust is won or lost.
10. **Checkpoint / Stage 1 done:** matches the scope doc's §30 success criteria — a factory can go from client registration through lot receiving, production, delivery, invoicing, payment, payroll, and reporting, entirely inside its isolated workspace, with weekly emails going out automatically.

---

## 4. Local ↔ Live Workflow (Git, Vercel & Railway via Claude Code)

**One-time setup — Claude Code does this once at the start of Phase 0:**
1. `git init`, initial commit, push to a new GitHub repo; create `main` (production) and `dev` (integration) branches.
2. `vercel link` inside `apps/web` → connects the repo to a Vercel project (root directory set to `apps/web` since it's a monorepo).
3. Railway project created via the Railway CLI or dashboard, GitHub-connected to the same repo with root directories set to `apps/api` and `apps/worker`.
4. Env vars set **three times**, once per environment — this is the part people get wrong:
   - **Local**: `.env` / `.env.local` files, git-ignored, pointing at Docker Postgres/Redis (`localhost`).
   - **Preview** (Vercel Preview + a Railway PR environment or staging service): pointing at a Neon/Supabase *branch* database, not production.
   - **Production**: pointing at the real production database, set in Vercel's Production env and Railway's production service.
5. Neon/Supabase database branching turned on so every Vercel preview URL has an isolated database, not a shared one.

**The day-to-day loop, once setup is done:**
1. You work locally against Docker Postgres/Redis — nothing touches the internet yet.
2. When a feature/task from the pipeline above is working locally, Claude Code commits and pushes to a feature branch (or directly to `dev`, your call on strictness).
3. Push triggers Vercel to build a **Preview deployment** (unique URL per branch/PR) and Railway to build a matching preview/staging API — this is "live" in the sense of being on the internet, but isolated from real customer data.
4. You test against that live preview URL — this is where you catch anything that only breaks in a deployed environment (env var typos, CORS, build-only errors).
5. Once verified, Claude Code merges `dev` → `main`. That push auto-deploys Vercel Production and Railway Production, and the Railway release step runs `alembic upgrade head` against the real database.
6. Claude Code can also pull logs (`vercel logs`, `railway logs`) if something breaks live, and `vercel env pull` / `railway variables` to sync env vars back down when needed.

**Rule of thumb:** nothing reaches the production database except through a merge to `main` and its automatic migration step — never a manual migration run against production, even from Claude Code.

---

## 5. Suggested Cadence

Given this is a single-developer build: treat each phase as 2–4 weeks depending on your pace. Don't start a phase's UI before its schema + API are working and tested — the doc's own domain logic (proportional colour allocation, component roll-ups, ledger math, stitch billing) is where bugs are expensive, so get those right at the API/schema level first, then build screens against a working API.

Explicitly **not** in this pipeline (per scope doc §28 — out of Stage 1): design ideation/approval workflow, rework/QC, automatic stock consumption, native mobile apps, WhatsApp automation, full GL/balance sheet/tax, biometric attendance, machine IoT integration, client self-service portal.
