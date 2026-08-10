.PHONY: up down api web worker migrate seed install

up:
	docker compose up -d

down:
	docker compose down

install:
	cd apps/api && uv sync
	cd apps/worker && uv sync
	pnpm install

api:
	cd apps/api && uvicorn app.main:app --reload --port 8000

web:
	pnpm --filter web dev

worker:
	cd apps/worker && celery -A worker.celery_app worker --beat --loglevel=info

migrate:
	cd apps/api && alembic upgrade head

makemigration:
	cd apps/api && alembic revision --autogenerate -m "$(name)"

seed:
	cd apps/api && python -m app.seed
