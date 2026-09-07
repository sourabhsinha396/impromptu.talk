# v0 parity

The acceptance list for the board. Every route and every behaviour v0 had, with the v1 card that carries it and a tick once it has landed on `main`. Nothing on this list may be quietly dropped; a line that v1 changes on purpose says so and points at `DECISIONS.md`.

Ticked as of 2026-09-07, after cards 01 to 25.

## Routes

| v0 | v1 | Card | Done |
|---|---|---|---|
| `GET /healthz` | `GET /api/v1/common/health` | 01 | [x] |
| `GET /` (the tool) | `/` | 08, 12, 13 | [x] |
| `GET /genres` | `/genres` | 09 | [x] |
| `GET /genre/{slug}` | `/genre/[slug]` | 09 | [x] |
| `GET /topic/{slug}` answers 404 | same, by having no route | 09 | [x] pinned |
| `GET /?topic=<slug>` deep link | same | 12 | [ ] |
| `POST /api/sessions` | `POST /api/v1/runs` | 15 | [x] |
| `GET /streak` | `/streak` | 17 | [x] |
| `POST /streak/share` | `POST /api/v1/runs/share` | 18 | [x] |
| `GET /s/{token}` | `/s/[token]` | 18 | [x] |
| `GET`/`POST /signup` | `/signup`, `POST /api/v1/auth/signup` | 19 | [x] |
| `GET`/`POST /login`, `POST /logout` | `/login`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout` | 19 | [x] |
| (none: page context) | `GET /api/v1/auth/me` | 05 | [x] |
| `GET /login/google`, callback | same | 21 | [x] |
| `GET`/`POST /forgot`, `GET`/`POST /reset/{token}` | `/forgot`, `/reset/[token]`, `POST /api/v1/auth/forgot`, `GET`/`POST /api/v1/auth/reset` | 20 | [x] |
| `GET /account`, `POST /account/name`, `/password`, `/sessions`, `/accent` | `/account`, `/account/additional-settings`, `GET /api/v1/auth/account`, `PATCH /name`, `PATCH /accent`, `POST /password` | 23 | [x] The path is `additional-settings`, `DECISIONS.md`. The subscription section says "Everything is free right now" until 24 to 26; the affiliate section waits for the code's minting on 31 |
| `POST /account/billing` (portal) | `/api/v1/payments/portal` | 26 | [ ] |
| `GET /pro`, `POST /pro` (currency) | `/pro` | 25 | [ ] |
| `POST /pro/checkout`, `GET /pro/done` | `/api/v1/payments/checkout`, `/pro/done` | 26 | [ ] |
| `GET`/`POST /packs`, `GET /packs/{slug}`, topics add/edit/delete, `/delete` | `/packs`, `/packs/[slug]`, `v1/topics` owned-genre endpoints | 29 | [ ] |
| `POST /packs/{slug}/generate` | `/api/v1/topics/.../generate` | 30 | [ ] |
| (new) share an owned genre, `/g/[token]` | | 29 | [ ] |
| `GET /affiliate`, `GET /affiliate/referrals`, `POST /affiliate/paypal` | same | 31 | [ ] |
| `GET /administration`, `/staged-topic`, `GET`/`POST /pro`, `POST /pro/revoke`, `GET`/`POST /payouts`, `GET`/`POST /outreach` | same paths | 32 | [ ] |
| `/admin` (sqladmin, env password) | `/re-admin/` (Django admin, `is_staff`) | 01, 28 | [x] mounted; User, Genre, Topic registered; the rest per card |
| `/about`, `/contact`, `/privacy`, `/terms`, `/refunds` | same | 33 | [ ] |
| `GET /robots.txt`, `GET /sitemap.xml` | `robots.ts`, `sitemap.ts` | 05 | [x] |
| 404, 405, 422, 500 as pages outside `/api` | `not-found.tsx`, `error.tsx`; forms re-render with a sentence | 05, 19 | [x] 404 and 500; sign up and sign in forms (19); the rest per card |

## Behaviours

### Foundation and posture

- [x] Production refuses to boot without `SECRET_KEY`, `ALLOWED_HOSTS`, `POSTGRES_HOST` (02)
- [x] Test settings blank every provider key; tests hold no credentials (02, and each service card adds its key)
- [x] Session cookie `impromptu_session`, HttpOnly, Lax, 30 days, DB-backed (03)
- [x] Device cookie `impromptu_device`, signed, two years, issued on first API contact, rotated on sign-out (03, 19)
- [x] Timezone cookie `impromptu_tz` written before first paint (03)
- [x] Referral cookie `impromptu_ref` from `?ref=` on any GET, sixty days, last click wins (03)
- [x] Rate limiting, sliding window, keyed by address behind one trusted hop and by identity, 429 with Retry-After (03; per-route rates land with 15, 19, 20, 26)
- [x] CSRF: API exempt behind the first-party rewrite, admin protected, pinned by strict client (03)
- [x] `/account`, `/packs`, `/affiliate/referrals` gated on the cookie by the proxy; `/administration` left to 404 (03)
- [x] reCAPTCHA fails open (22)
- [x] Google sign-in fails closed (21)
- [ ] Slack logs instead of posting without a webhook (27)

### Design system

- [x] Stone neutrals, accent as hue and chroma with theme-owned lightness, six accents, ink button, note colours (04)
- [x] Every accent above 4.5:1 on both pages, read from the stylesheet (04)
- [x] The primary button never wears the accent (04)
- [x] Fonts self-hosted, one variable file per family per subset, latin preloaded, latin-ext by unicode-range (04)
- [x] Display face at wdth 96; ".talk" at 400 (04, 05)
- [x] Theme system, light, dark on `<html data-theme>`, pre-paint script, v0's storage key (04)
- [x] Every v0 emoji is a lucide glyph: ten genres, five styles, 24 badges, four tool cards, the chrome (04)
- [x] The die mark, favicon, apple icon (04)
- [x] Topic sized for a phone filming a laptop (04: tokens; 12: the page)

### Chrome

- [x] Header: die and wordmark, "i.t" on phones, streak pill as the only door to `/streak`, account menu (05)
- [x] Account menu holds destinations by sign-in state; Administration for superusers only; Get Pro unless Pro; theme as three stops (05)
- [x] Footer: brand column with the owner, Product, Company, Legal; bottom line by sign-in state, both halves pinned (05)
- [x] "Proudly made in India" only when the visitor is placed in India; the country ladder (05)
- [x] Chrome hides while filming (05, 12)
- [x] The Crisp bubble hides with it and is off on the home page (14)
- [x] Error pages route back into the tool (05)
- [x] Per-page title, description, canonical, OG and Twitter cards from one helper; one OG image (05)
- [x] Sitemap: home, `/genres`, `/pro`, `/affiliate`, the paperwork, the ten genre pages; no topics, no share pages, no operator paths (05)
- [x] robots: `/streak`, `/administration`, `/pro/done`, `/affiliate/referrals` disallowed (05)
- [ ] Weight: cold first visit at or under 209KB. **Measured 358KB on 2026-09-06**: fonts 160KB, HTML 7KB, CSS 6KB, framework script 186KB. Over budget; not chased yet (`DECISIONS.md`)

### Content

- [x] Ten genres, one flat list, the merge map; 1000 topics (v0 had 800; 200 added for v1); every style in every built-in genre (07)
- [x] Seeder as a one-off management command, never on boot; idempotent, never deletes a topic, deletes an emptied built-in genre, deactivates one still owning topics, never touches an owned genre (07)
- [x] Style (v0 format) as a tag, four values plus Surprise me (07)
- [x] The bank ships with the home page as one public, hour-cached endpoint; 24.7KB gzipped for 1000 topics (08)
- [x] Shuffled in the browser; no-repeat pool; tiered decoys (10)
- [x] `/genres` hub with all ten; every topic's text on its genre page, pinned by test (09)
- [x] No `/topic/` pages (09)
- [x] `/?topic=` deep link skips the spinner (12)
- [x] Genre pages carry JSON-LD and the blurb (09)

### The round

- [x] Six phases: idle, spin, topic, prep, speak, done (12)
- [x] The reel: decoys, overshoot ease, reduced motion skips it, settle backed by a timeout (11)
- [x] Sounds: reel ticks spaced by the reel's own ease, settle ding, metronome, end chime (11)
- [x] Prep: three sticky notes, 80 characters, tilted; "Speak now" skips prep (12)
- [x] Speak: ring timer, tabular numerals, notes echoed as chips; "Done" stops early and records (12)
- [x] Done: day N, topics, minutes (12; the numbers arrive with 15)
- [x] Wall-clock countdown; pause (10)
- [x] Reset (the approved mock's word for v0's back arrow) in prep, speak and topic, one step back, keeps topic and notes; Escape does the same and is read before the textarea guard; `round_left` with `left_from` and `spoken_seconds` (12)
- [x] Space starts and pauses, N gives a new topic (12)
- [x] Settings sheet: prep 0 to 30 min, speak 1 to 10 min, sounds; persisted; vanishes mid-round (13)
- [x] Genre sheet: ten genres by role option, Yours as a link, first with Pro and last without (13; own genres fill it on 29)
- [x] Staged topic per browser, read and cleared by the next draw, spin intact (12; the tool that writes it is 32)
- [ ] Finished run posted once, per-device limit 120 per hour (15)
- [x] Engine as a pure TypeScript module with fake-timer tests (10)

### Streak

- [x] Derived from runs, never stored; each row's own local day via its stored offset; today from the request's clock (16)
- [x] Whose runs count: an account across devices; an unclaimed device only its own (16)
- [x] The rule is the plan's: free five days and no freezes, Pro the plan's length with two freezes a month; one summary per request feeds the pill, the done screen and `/streak` (16, owner's change from v0)
- [ ] Pro freeze rule: two missed days a calendar month, all or nothing, repairs gaps behind you (16)
- [x] `/streak`: Day N with the flame, the three tiles, the plan's calendar ending today (a strip of five named days free, the heatmap on Pro), recent runs capped by the plan with the count said, the pitch only when true, the footer line by sign-in state, one button back to the tool, noindex (17). The share section lands with card 18; the payments switch that hides the Pro links lands with card 25
- [x] Share token minted once from the streak page, `/s/[token]` noindex, eight weeks for everybody, only bank topics named; the off switch lives in additional settings (18, 23)
- [x] Retention report: day-2 and day-7 cohorts in UTC days, as `retention_report` (15)

### Accounts

- [x] Email and password, minimum eight; forms re-render with one sentence, never a bare 422 (19). Name optional, `DECISIONS.md`
- [x] Django sessions; `?next=` honoured for own paths; sign out rotates the device; "sign out everywhere" (19; its button is 23)
- [x] Device claim on every door through the login signal; the collision case keeps both histories (15, 19)
- [x] Referral attributed at signup and frozen (19); the code is minted on 31
- [ ] Slack `signup` after commit (19, 27)
- [x] Password reset: one hour, ends every session; mail via the provider, console elsewhere (20). Every link in the hour works until one is used, `DECISIONS.md`
- [x] Google: second door, fails closed, links a verified address, `google_sub` first, no placeholder password, `?next=` in the signed state (21)
- [x] reCAPTCHA v2 on signup, login, forgot; public key only when both keys are set (22)
- [x] `/account` sections: subscription, colour; `/account/additional-settings`: name, email, password, sharing, sessions, closing (23). Purchases and the portal land with 24 to 26, the affiliate section with 31, and Save on the colour narrows to Pro with 24
- [x] Nothing on the site raises `is_staff` or `is_superuser`, pinned (19)

### Pro

- [x] Four plans, two shapes, comp plans not for sale; annual below lifetime; on sale only with key and product id (24). Prices moved from env into `apps/payments/plans.py`, `DECISIONS.md`
- [x] Eight currencies with rates, multipliers and rounding; static rates; picker of five; default by the ladder (24). The ladder lives once, in `frontend/lib/geo.ts`, with the `?currency=` pick on top; the picker itself is card 25
- [x] Entitlement: the best paid row, forever beats a date, status and expiry independent; the streak counted under the plan's own length; the colour refused without Pro (24). The lazy re-read of a lapsed subscription lands with 26, which is what talks to the provider
- [x] Purchase table ported column for column, `PROTECT` on the account, append-only in code (24)
- [x] `/pro` two cards with pills, priced by `GET /api/v1/payments/plans`, the currency picker, the questions, the refusal in place of a button, "not open yet" without a key (25). The overlay and the checkout it opens land together on 26, which owns the route: an SDK wired to a checkout that does not exist yet could not be tested through
- [ ] Checkout writes a pending row; settlement re-reads the payment; binding by reference and session; price as a log line; receipts by mail (26)
- [ ] Subscriptions: lazy refresh after expiry and on return from the portal; portal not a cancel button; cancel keeps the period; cancel flag separate from status; customer id backfilled lazily (26)
- [ ] Slack's six events, never raising, cancellation as the flip (27)
- [ ] Django admin as the owner console over every table; refunds recorded there (28)

### Owned genres (v0 packs)

- [ ] Genre rows with an owner; slug unique per owner; icon from the 24; caps 10 and 200 (29, confirm at start)
- [ ] Coined style: as typed, max 24, only in owned genres, built-in name gets the built-in, paste cannot coin (29)
- [ ] Editor: paste, inline edit, delete, share on and off, delete genre; `/packs` list; Pro required section (29)
- [ ] Sharing: `/g/[token]`, noindex, "Practise this" into the picker (29, 08, 13)
- [ ] Generate five from a prompt, five a month from rows, failed call spends one, off without a key (30)
- [x] Yours in the picker first with Pro, last without, never removed (13); lapsed subscriber keeps genres (29)

### Affiliates

- [ ] Code shape and minting; link on `/account` and `/affiliate` (31)
- [ ] 30% of the charge, written at settlement; balance derived; nobody named; payouts by operator from $10 (31, 32)
- [ ] `/affiliate` pitch with the rate and sample faces; `/affiliate/referrals` with PayPal address (31)

### Administration

- [ ] 404 gate for everybody but superusers (32)
- [ ] Grid of tool cards: staged topic, Pro by hand (comp plans, revoke refuses paid rows), payouts, outreach with the rate pinned (32)

### Analytics and support

- [x] PostHog: on with `DEBUG_ENV=production` and a token, device as distinct id, email and name as person properties, PostHog's defaults on, the notes' replay mask pinned in config and markup (14)
- [x] Crisp: every page but home, hidden while filming, address on the session when signed in, footer clears the bubble (14)

### Pages

- [ ] About, contact (with the form and its limit), privacy (states the replay masking), terms (the affiliate rate), refunds (33)

### Launch

- [ ] Parity audit of this list; weight; data migration from v0 (users, sessions, purchases, packs to owned genres); cutover (34)
