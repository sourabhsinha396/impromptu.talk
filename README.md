# impromptu.talk

A random topic. A minute to think. A minute to talk.

Two apps in one repo: `frontend/` (Next.js, port 3008) and `backend/` (Django + django-ninja, port 8008). `AGENTS.md` is the rulebook.

## Run

Databases, from the repo root (Postgres 17 and Redis 8, on loopback):

```bash
docker compose up -d db redis
```

Backend, from `backend/` (copy `.env.example` to `.env` once):

```bash
uv sync
uv run python manage.py migrate --settings=impromptu.settings.local
uv run python manage.py runserver 8008 --settings=impromptu.settings.local
```

Or run the whole backend stack in containers instead, from the repo root: `docker compose up --build`.

Frontend, from `frontend/`:

```bash
pnpm install
pnpm dev
```

Then http://localhost:3008. The frontend forwards `/api/*` to the backend, so `http://localhost:3008/api/v1/common/health` answers through the rewrite.

## Tests and lint

```bash
cd backend && uv run pytest && uv run ruff check .
```

```bash
cd frontend && pnpm test && pnpm lint
```
