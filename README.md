# impromptu.talk

A random topic. A minute to think. A minute to talk.

Two apps in one repo: `frontend/` (Next.js, port 3009) and `backend/` (Django + django-ninja, port 8009). `AGENTS.md` is the rulebook.

## Run

Backend, from `backend/`. Copy `.env.example` to `.env` once, then:

```bash
docker compose up --build
```

That is Postgres 17, Redis 8 and the API on http://localhost:8009, migrated on boot. `apps/` and `impromptu/` are mounted into the container, so code edits reload without a rebuild; a dependency change needs `--build` again. Stop it with `Ctrl+C`, or `docker compose down` from another terminal.

Management commands run inside the container. Seed the topic bank once (idempotent, run again only after editing `data/topics/`), and make yourself a superuser:

```bash
docker compose exec web python manage.py seed_topics
```

```bash
docker compose exec web python manage.py createsuperuser
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

http://localhost:8009/admin/ with the superuser made above. Every table, editable.

## Spend

Two things here cost money on use, and both are capped twice.

- Generating topics: five per account per calendar month, counted from the `generations` table (`backend/apps/topics/generate.py`). Set a **hard spend limit on the OpenRouter key** in their dashboard as well - that is the cap that holds if this one has a bug. No key means the feature is off: the pane is not drawn and the route 404s.
- Mail and the Slack webhook are per event and free at this volume, but the same rule applies: a key that can be reached is a key that can be spent, so the test settings blank every one of them.

## Docs

`docs/SPEC.md` is every settled product decision, `docs/PRICING.md` everything with money in it, `docs/DECISIONS.md` the dated log of what v1 decided on its own, and `docs/tech/v0-parity.md` the checklist of what has landed.
