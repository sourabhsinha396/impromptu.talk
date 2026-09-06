# impromptu conventions

impromptu.talk: a random topic, a minute to think, a minute to talk. This repo is v1, the rebuild of v0 (FastAPI + Jinja, at `../zpersonal/0-lessworked/impromptuv0`) on Next.js + Django Ninja, in the shape of `../algoholic`. Read `docs/SPEC.md` and `docs/PRICING.md` for every settled product decision, `docs/DECISIONS.md` for the dated log of the calls v1 makes on its own, and `docs/tech/v0-parity.md` for what has landed and what has not. This file is the rulebook: what is true everywhere, all the time. Where another doc disagrees with this one, this one wins.

## The three rules

1. **Parity first.** Every v0 feature ships in v1 before any new one is discussed. v0 is the spec and the baseline, and it is read-only: port behaviour, copy, algorithms and tests; never copy files. `docs/tech/v0-parity.md` is the acceptance list.
2. **Simple product.** An improvement earns its place by removing something. Django's own auth, sessions, hashers, migrations, mail backends and admin replace hand-rolled ones; shadcn replaces hand-rolled sheets and menus; a pure TypeScript run engine replaces DOM script. No caching layers, no queues, no webhooks, no abstraction for a provider that does not exist. If a change is getting clever, stop and ask.
3. **The ten-second rule outranks features.** A stranger lands on the site and is talking out loud within ten seconds, having clicked exactly one button. Home is the tool: near-zero words, one primary button, everything else behind the account menu. Chrome hides during the round.

## Copy

- No em dashes anywhere: prose, code, comments, commit messages. Use a spaced hyphen when a pause is needed.
- Plain nouns in filenames, identifiers and CSS classes. No metaphors, no trade jargon. If a name needs the codebase explained before it reads, it is the wrong name.
- Sentence case for UI labels and headings. Contractions are fine.
- Public copy never names the stack. No competitor names in README, code or commits.

## Run

Frontend, from `frontend/`:

- `pnpm dev` serves on 3009. `pnpm build` for production. `pnpm test` runs vitest once, `pnpm test:watch` keeps it running. `pnpm lint` typechecks.

Backend, from `backend/`:

- `docker compose up --build` is how the backend runs: Postgres 17, Redis 8 and the API on 8009, migrated on boot. `apps/` and `impromptu/` are bind-mounted and reload on edit; a dependency change needs `--build` again. Copy `.env.example` to `.env` first.
- Management commands run in the container: `docker compose exec api python manage.py <cmd>`.
- The database and Redis are not published on the host, so their ports never collide with the neighbouring stacks. Reach them through the container: `docker compose exec db psql -U impromptu impromptu`.
- The app is on Postgres everywhere it runs. The only SQLite in the project is the in-memory one tests use, pinned by test.

Tests and lint, from `backend/` on the host:

- `uv run pytest` runs the suite against in-memory SQLite; no Docker, no credentials.
- `uv run ruff check .` lints; line length is 120.
- `manage.py` defaults to production settings on purpose: a host that forgot its `.env` gets the settings that refuse to boot, not DEBUG.
- `.env` is add-only: a session may add a key (mirrored in `.env.example`), never change or remove an existing value.

Ports are 3009 and 8009. algoholic keeps 3007/8007 and v0 keeps 8078, so all three run at once during the port.

## Invariants

- **One domain, one app.** Backend code lives in `backend/apps/<domain>/` with `apis.py`, `schemas.py`, `models.py`, `services.py`, `admin.py`. The router variable is always `api`. Modules are named for the thing, never `helpers` or `utils`.
- **Product policy lives in code, not env.** Env holds only secrets and addresses. Prices, limits and rules are code, reviewed like code.
- **Production refuses to boot misconfigured.** A missing SECRET_KEY, ALLOWED_HOSTS or POSTGRES_HOST raises at startup, pinned by tests.
- **Tests hold no credentials by construction.** Testing settings blank every provider key; a developer's `.env` cannot leak a live key into a run.
- **Sessions, not JWT.** The cookie is `impromptu_session`, HttpOnly, SameSite Lax, prefixed so localhost ports do not share sessions with neighbouring apps.
- **Four cookies, all prefixed.** `impromptu_session` and the signed `impromptu_device` are the backend's (`apps/common/devices.py` writes the device one on every API response); `impromptu_ref` and `impromptu_tz` are the frontend's (`frontend/lib/cookies.ts`, set by `proxy.ts` and an inline script). Nothing else is stored in the browser except the theme.
- **Rate limits are declared beside their routes** with `apps.common.ratelimit.throttle`; the ninja surface is csrf-exempt and the admin is not. Neither lives in env.
- **The browser never calls the backend directly.** Every browser request rides the `/api` rewrite in `frontend/app/api/[...path]/route.ts`. Server components call the backend origin with forwarded cookies.
- **Design tokens live in `globals.css` only, and little else does.** It holds the tokens, the four `@font-face` rules and a short base layer; everything else is Tailwind utilities, shadcn copied in, and Magic UI on marketing surfaces. Components use token utilities, never raw hex. The accent colours what you read; the primary button is ink and its colour never moves.
- **Icons are lucide, mapped by meaning in `components/site/icons.tsx`.** Nothing on the site is an emoji.
- **shadcn is copied in, not depended on.** Never run `shadcn init`; on Tailwind v4 it rewrites `globals.css`. `components.json` is hand-written. The button is ours (`components/site/button.tsx`), not the registry's.
- **Tests are centralized on both sides, few and fast.** `backend/tests/unit_tests/<app>/` mirrors the apps, with rows from `tests/unit_tests/factories.py`; `frontend/tests/` mirrors `app/`, `lib/` and `components/`. A test pins a decision or a behaviour that would break silently (a contrast floor, a cookie flag, a fallback); it does not check that markup renders. Test names read as sentences. Each side's whole suite runs in under a minute, two at the very most; a test that needs seconds is testing the wrong layer, and both runners print their slow ones. No network, no real timers.
- **Comments carry only the non-obvious why**, ideally with the named failure that motivated them.
- **One branch, one feature at a time.** Everything lands directly on `main`; no feature branches, no worktrees. One board card is in doing at any moment, and it is committed and moved to done before the next one starts.

## Decisions

Every decision taken while building v1 is one dated bullet in `docs/DECISIONS.md`, written in the same change that makes it, with the reason. A reversed decision gets a new bullet; the old one stays. If you are about to decide something and it is not in that file, `docs/SPEC.md` or `docs/PRICING.md`, decide it, then write it down.

## Tracking

Work is tracked on the Trello board (lists todo / doing / done / later). Labels are priorities: green low, yellow medium, orange high, red critical. A card moves to doing when work on it starts and to done when that work is committed on main; one card in doing at a time. Card 00 on the board is the short version of this file.
