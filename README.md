# impromptu.talk

A random topic. A minute to think. A minute to talk.

Two apps in one repo: `frontend/` (Next.js, port 3009) and `backend/` (Django + django-ninja, port 8009). `AGENTS.md` is the rulebook.

## Run

Backend, from `backend/`. Copy `.env.example` to `.env` once, then:

```bash
docker compose up --build
```

That is Postgres 17, Redis 8 and the API on http://localhost:8009, migrated on boot. `apps/` and `impromptu/` are mounted into the container, so code edits reload without a rebuild; a dependency change needs `--build` again. Stop it with `Ctrl+C`, or `docker compose down` from another terminal.

Management commands run inside the container:

```bash
docker compose exec api python manage.py createsuperuser
```

Frontend, from `frontend/`:

```bash
pnpm install
pnpm dev
```

Then http://localhost:3009. The frontend forwards `/api/*` to the backend, so `http://localhost:3009/api/v1/common/health` answers through the rewrite.

## Tests and lint

On the host, no Docker needed (tests run on in-memory SQLite):

```bash
cd backend && uv sync && uv run pytest && uv run ruff check .
```

```bash
cd frontend && pnpm test && pnpm lint
```

## Admin

http://localhost:8009/re-admin/ with the superuser made above. Every table, editable.
