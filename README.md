# Embroidery Factory Management SaaS — Starter

Phase 0 scaffold matching `ROADMAP.md`. This gets you to the Phase 0 checkpoint:
an empty app running locally, ready to build Phase 1 (auth, tenancy, roles) on top of.

## Stack
Next.js (frontend) · FastAPI (backend) · PostgreSQL + Row-Level Security · SQLAlchemy/Alembic · Celery + Redis · see `ROADMAP.md` for the full rationale and build order.

## Prerequisites
- Docker (for Postgres + Redis)
- Node.js 20+ and pnpm (`npm i -g pnpm`)
- Python 3.12+ and [uv](https://docs.astral.sh/uv/) (`pip install uv`)

## Quickstart

```bash
# 1. Start Postgres + Redis
docker compose up -d

# 2. Backend
cd apps/api
cp .env.example .env
uv sync
uv run alembic revision --autogenerate -m "init"
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:app --reload --port 8000
```

In a second terminal:

```bash
# 3. Frontend
cd apps/web
cp .env.local.example .env.local
pnpm install
pnpm dev
```

In a third terminal (optional at Phase 0, needed from Phase 5 onward):

```bash
# 4. Worker
cd apps/worker
cp .env.example .env
uv sync
uv run celery -A celery_app worker --beat --loglevel=info
```

Then open http://localhost:3000 — the page should show "API status: connected (local)".

Demo login seeded by `app/seed.py`: `admin@demo-factory.test` / `changeme123` (Phase 0 only has the schema, not a login screen yet — that's Phase 1).

## Repo layout
```
/apps
  /web      → Next.js frontend        → deploy to Vercel
  /api      → FastAPI backend         → deploy to Railway
  /worker   → Celery worker + beat    → deploy to Railway
/packages
  /types    → generated from FastAPI's OpenAPI spec (Phase 1+)
  /ui       → shared React components (once there's a second consumer)
```

## Next steps
Everything from here on is `ROADMAP.md`, Phase 1 onward: RLS policies, auth, roles & permissions, onboarding wizard, then Parties/Lots/Designs/Production/etc. module by module.
