# v0 parity

The acceptance list for the board. Every route and every behaviour v0 had, with the v1 card that carries it and a tick once it has landed on `main`. Nothing on this list may be quietly dropped; a line that v1 changes on purpose says so and points at `DECISIONS.md`.

Ticked as of 2026-09-06, after cards 01 to 06.

## Routes

| v0 | v1 | Card | Done |
|---|---|---|---|
| `GET /healthz` | `GET /api/v1/common/health` | 01 | [x] |
| `GET /` (the tool) | `/` | 12 | [ ] placeholder only |
| `GET /genres` | `/genres` | 09 | [ ] |
| `GET /genre/{slug}` | `/genre/[slug]` | 09 | [ ] |
| `GET /topic/{slug}` answers 404 | same, by having no route | 09 | [ ] |
| `GET /?topic=<slug>` deep link | same | 12 | [ ] |
| `POST /api/sessions` | `POST /api/v1/sessions` | 15 | [ ] |
| `GET /streak` | `/streak` | 17 | [ ] |
| `POST /streak/share` | `POST /api/v1/sessions/share` | 18 | [ ] |
| `GET /s/{token}` | `/s/[token]` | 18 | [ ] |
| `GET`/`POST /signup` | `/signup`, `POST /api/v1/auth/signup` | 19 | [ ] |
| `GET`/`POST /login`, `POST /logout` | `/login`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout` | 19 | [ ] |
| (none: page context) | `GET /api/v1/auth/me` | 05 | [x] |
| `GET /login/google`, callback | same | 21 | [ ] |
| `GET`/`POST /forgot`, `GET`/`POST /reset/{token}` | `/forgot`, `/reset/[token]` and their endpoints | 20 | [ ] |
| `GET /account`, `POST /account/name`, `/password`, `/sessions`, `/accent` | `/account`, `/account/additional`, `PATCH`/`POST` under `v1/auth` | 23 | [ ] |
| `POST /account/billing` (portal) | `/api/v1/payments/portal` | 26 | [ ] |
| `GET /pro`, `POST /pro` (currency) | `/pro` | 25 | [ ] |
| `POST /pro/checkout`, `GET /pro/done` | `/api/v1/payments/checkout`, `/pro/done` | 26 | [ ] |
| `GET`/`POST /packs`, `GET /packs/{slug}`, topics add/edit/delete, `/delete` | `/packs`, `/packs/[slug]`, `v1/topics` owned-genre endpoints | 29 | [ ] |
| `POST /packs/{slug}/generate` | `/api/v1/topics/.../generate` | 30 | [ ] |
| (new) share an owned genre, `/g/[token]` | | 29 | [ ] |
| `GET /affiliate`, `GET /affiliate/referrals`, `POST /affiliate/paypal` | same | 31 | [ ] |
| `GET /administration`, `/staged-topic`, `GET`/`POST /pro`, `POST /pro/revoke`, `GET`/`POST /payouts`, `GET`/`POST /outreach` | same paths | 32 | [ ] |
| `/admin` (sqladmin, env password) | `/re-admin/` (Django admin, `is_staff`) | 01, 28 | [x] mounted; models per card |
| `/about`, `/contact`, `/privacy`, `/terms`, `/refunds` | same | 33 | [ ] |
| `GET /robots.txt`, `GET /sitemap.xml` | `robots.ts`, `sitemap.ts` | 05 | [x] |
| 404, 405, 422, 500 as pages outside `/api` | `not-found.tsx`, `error.tsx`; forms re-render with a sentence | 05, 19 | [x] 404 and 500; forms per card |

## Behaviours

### Foundation and posture

- [x] Production refuses to boot without `SECRET_KEY`, `ALLOWED_HOSTS`, `POSTGRES_HOST` (02)
- [x] Test settings blank every provider key; tests hold no credentials (02, and each service card adds its key)
- [x] Session cookie `impromptu_session`, HttpOnly, Lax, 30 days, DB-backed (03)
- [x] Device cookie `impromptu_device`, signed, two years, issued on first API contact, rotated on sign-out (03; the rotation call lands with 19)
- [x] Timezone cookie `impromptu_tz` written before first paint (03)
- [x] Referral cookie `impromptu_ref` from `?ref=` on any GET, sixty days, last click wins (03)
- [x] Rate limiting, sliding window, keyed by address behind one trusted hop and by identity, 429 with Retry-After (03; per-route rates land with 15, 19, 20, 26)
- [x] CSRF: API exempt behind the first-party rewrite, admin protected, pinned by strict client (03)
- [x] `/account`, `/packs`, `/affiliate/referrals` gated on the cookie by the proxy; `/administration` left to 404 (03)
- [ ] reCAPTCHA fails open (22)
- [ ] Google sign-in fails closed (21)
- [ ] Slack logs instead of posting without a webhook (27)

### Design system

- [x] Stone neutrals, accent as hue and chroma with theme-owned lightness, six accents, ink button, note colours (04)
- [x] Every accent above 4.5:1 on both pages, read from the stylesheet (04)
- [x] The primary button never wears the accent (04)
- [x] Fonts self-hosted, one variable file per family per subset, latin preloaded, latin-ext by unicode-range (04)
- [x] Display face at wdth 96; ".talk" at 400 (04, 05)
- [x] Theme system, light, dark on `<html data-theme>`, pre-paint script, v0's storage key (04)
- [x] Every v0 emoji is a lucide glyph: ten genres, five categories, 24 badges, four tool cards, the chrome (04)
- [x] The die mark, favicon, apple icon (04)
- [x] Topic sized for a phone filming a laptop (04: tokens; 12: the page)

### Chrome

- [x] Header: die and wordmark, "i.t" on phones, streak pill as the only door to `/streak`, account menu (05)
- [x] Account menu holds destinations by sign-in state; Administration for superusers only; Get Pro unless Pro; theme as three stops (05)
- [x] Footer: brand column with the owner, Product, Company, Legal; bottom line by sign-in state, both halves pinned (05)
- [x] "Proudly made in India" only when the visitor is placed in India; the country ladder (05)
- [x] Chrome hides while filming (05: the variant; 12: the engine sets it)
- [ ] The Crisp bubble hides with it and is off on the home page (14)
- [x] Error pages route back into the tool (05)
- [x] Per-page title, description, canonical, OG and Twitter cards from one helper; one OG image (05)
- [x] Sitemap: home, `/genres`, `/pro`, `/affiliate`, the paperwork, the ten genre pages; no topics, no share pages, no operator paths (05)
- [x] robots: `/streak`, `/administration`, `/pro/done`, `/affiliate/referrals` disallowed (05)
- [ ] Weight: cold first visit at or under 209KB. **Measured 358KB on 2026-09-06**: fonts 160KB, HTML 7KB, CSS 6KB, framework script 186KB. Over budget; not chased yet (`DECISIONS.md`)

### Content

- [ ] Ten genres, one flat list, the merge map; 800 topics; every category in every built-in genre (07)
- [ ] Seeder idempotent, never deletes a topic, deletes an emptied built-in genre, deactivates one still owning topics, never touches an owned genre (07)
- [ ] Category (v0 format) as a tag, four values plus Surprise me (07)
- [ ] The bank ships with the home page and is shuffled in the browser; no-repeat pool; tiered decoys (08, 10)
- [ ] `/genres` hub with all ten; every topic's text on its genre page, pinned by test (09)
- [ ] No `/topic/` pages; `/?topic=` deep link skips the spinner (09, 12)
- [ ] Genre pages carry JSON-LD and the blurb (09)

### The round

- [ ] Six phases: idle, spin, topic, prep, speak, done (12)
- [ ] The reel: decoys, overshoot ease, reduced motion skips it, settle backed by a timeout (11)
- [ ] Sounds: reel ticks spaced by the reel's own ease, settle ding, metronome, end chime (11)
- [ ] Prep: three sticky notes, 80 characters, tilted; "Speak now" skips prep (12)
- [ ] Speak: ring timer, tabular numerals, notes echoed as chips; "Done" stops early and records (12)
- [ ] Done: day N, topics, minutes (12)
- [ ] Wall-clock countdown; pause (10)
- [ ] Back arrow in prep, speak and topic, one step back, keeps topic and notes; Escape does the same and is read before the textarea guard; `round_left` with `left_from` and `spoken_seconds` (12)
- [ ] Space starts and pauses, N gives a new topic (12)
- [ ] Settings sheet: prep 0 to 30 min, speak 1 to 10 min, sounds; persisted; vanishes mid-round (13)
- [ ] Genre sheet: ten genres by role option, Yours as a link, first with Pro and last without (13)
- [ ] Staged topic per browser, read and cleared by the next draw, spin intact (12, 32)
- [ ] Finished run posted once, per-device limit 120 per hour (15)
- [ ] Engine as a pure TypeScript module with fake-timer tests (10)

### Streak

- [ ] Derived from sessions, never stored; the visitor's local day via the UTC offset (16)
- [ ] Whose runs count: an account across devices; an unclaimed device only its own (16)
- [ ] Pro freeze rule: two missed days a calendar month, all or nothing, repairs gaps behind you (16)
- [ ] `/streak`: current streak, totals, eight-week and one-year calendars ending today (17)
- [ ] Share token minted once, `/s/[token]` noindex, no off switch on the site (18)
- [ ] Retention report: day-2 and day-7 cohorts in UTC days, as a management command (15)

### Accounts

- [ ] Email and password, minimum eight; forms re-render with one sentence, never a bare 422 (19)
- [ ] Django sessions; `?next=` honoured for own paths; sign out rotates the device; "sign out everywhere" (19, 23)
- [ ] Device claim on both doors; the collision case keeps both histories (15, 19)
- [ ] Referral attributed at signup and frozen (19, 31)
- [ ] Slack `signup` after commit (19, 27)
- [ ] Password reset: one hour, newest only, ends every session; mail via the provider, console elsewhere (20)
- [ ] Google: second door, fails closed, links a verified address, `google_sub` first, no placeholder password, `?next=` in the signed state (21)
- [ ] reCAPTCHA v2 on signup, login, forgot; public key only when both keys are set (22)
- [ ] `/account` sections: account, email, subscription; `/account/additional`: accent (Pro), sessions (23)
- [ ] Nothing on the site raises `is_staff` or `is_superuser`, pinned (19)

### Pro

- [ ] Four plans, two shapes, comp plans not for sale; annual below lifetime; on sale only with key and product id (24)
- [ ] Eight currencies with rates, multipliers and rounding; static rates; picker of five; default by the ladder (24)
- [ ] `/pro` two cards with pills; overlay checkout; nothing linked without a key (25)
- [ ] Checkout writes a pending row; settlement re-reads the payment; binding by reference and session; price as a log line; receipts by mail (26)
- [ ] Subscriptions: lazy refresh after expiry and on return from the portal; portal not a cancel button; cancel keeps the period; cancel flag separate from status; customer id backfilled lazily (26)
- [ ] Slack's six events, never raising, cancellation as the flip (27)
- [ ] Django admin as the owner console over every table; refunds recorded there (28)

### Owned genres (v0 packs)

- [ ] Genre rows with an owner; slug unique per owner; icon from the 24; caps 10 and 200 (29, confirm at start)
- [ ] Coined category: as typed, max 24, only in owned genres, built-in name gets the built-in, paste cannot coin (29)
- [ ] Editor: paste, inline edit, delete, share on and off, delete genre; `/packs` list; Pro required section (29)
- [ ] Sharing: `/g/[token]`, noindex, "Practise this" into the picker (29, 08, 13)
- [ ] Generate five from a prompt, five a month from rows, failed call spends one, off without a key (30)
- [ ] Yours in the picker first with Pro, last without, never removed; lapsed subscriber keeps genres (13, 29)

### Affiliates

- [ ] Code shape and minting; link on `/account` and `/affiliate` (31)
- [ ] 30% of the charge, written at settlement; balance derived; nobody named; payouts by operator from $10 (31, 32)
- [ ] `/affiliate` pitch with the rate and sample faces; `/affiliate/referrals` with PayPal address (31)

### Administration

- [ ] 404 gate for everybody but superusers (32)
- [ ] Grid of tool cards: staged topic, Pro by hand (comp plans, revoke refuses paid rows), payouts, outreach with the rate pinned (32)

### Analytics and support

- [ ] PostHog: production only, device as distinct id, email as a property, autocapture off, replay on with both masks pinned (14)
- [ ] Crisp: every page but home, hidden while filming, address on the session when signed in (14)

### Pages

- [ ] About, contact (with the form and its limit), privacy (states the replay masking), terms (the affiliate rate), refunds (33)

### Launch

- [ ] Parity audit of this list; weight; data migration from v0 (users, sessions, purchases, packs to owned genres); cutover (34)
