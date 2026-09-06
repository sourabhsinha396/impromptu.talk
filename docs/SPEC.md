# impromptu.talk - product spec

A random topic. A minute to think. A minute to talk. Every day.

This is the record of every settled product decision, carried over from v0 (the FastAPI and Jinja build at `../zpersonal/0-lessworked/impromptuv0`, whose `CLAUDE.md`, `docs/SPEC.md` and code comments were the record until now) and updated for v1. Payments, Pro, affiliates and everything with money in it are in [`PRICING.md`](PRICING.md). The dated log of calls v1 makes on its own is [`DECISIONS.md`](DECISIONS.md). What has landed is ticked in [`tech/v0-parity.md`](tech/v0-parity.md). `AGENTS.md` at the root is the rulebook and wins where this disagrees with it.

If you decide something this document does not cover, add it here in the same change.

---

## 1. What it is

The whole product is one loop that takes about two minutes:

```
topic -> prep -> speak -> done -> streak
```

Everything else hangs off that loop and must never get in front of it.

**The ten-second rule outranks features.** A person who has never heard of impromptu speaking lands on the site and is talking out loud within ten seconds, having clicked exactly one button. If a feature breaks that, the feature is wrong. The home page is the tool: near-zero words on screen, one primary button, everything else behind the account menu in the header, the theme included, because a preference set once does not earn a permanent control. The streak is a flame and a digit. Chrome hides itself during the round.

**The gate.** A stranger lands, completes a full run with no instructions, and comes back the next day. Day-2 and day-7 return are the numbers the roadmap waits on; the retention report (§5) exists so they are read off our own table and not only off analytics.

**No daily topic.** People choose their genre in the app rather than being handed one. The streak carries the come-back-tomorrow job alone.

**People film this.** A laptop sits across the room from a phone. The topic is sized to be legible in that frame, the ring timer is the visual hook, and everything a creator used to add in editing (the topic on screen, the clock) the site draws for free.

---

## 2. What v1 is

v1 is v0 rebuilt on Next.js and Django Ninja, in the shape of `../algoholic`, so that voice analysis and model-based feedback have somewhere to live later. Three rules govern every card, stated in full in `AGENTS.md`:

1. **Parity first.** Every v0 feature ships in v1 before any new one is discussed. v0 is the spec and the baseline and is read-only: port behaviour, copy, algorithms and tests; never copy files.
2. **Simple product.** An improvement earns its place by removing something. Django's own auth, sessions, hashers, migrations, mail and admin replace hand-rolled ones; shadcn replaces hand-rolled sheets and menus; a pure TypeScript run engine replaces DOM script. No caching layers, no queues, no webhooks.
3. **The ten-second rule** above.

Decisions that changed with the rebuild, each with its reason in `DECISIONS.md`:

- **Stack and ports.** Django 5.2 with django-ninja on 8009, Next 16 with React 19 and Tailwind v4 on 3009, Postgres everywhere the app runs, Redis for rate-limit counters only. The browser never calls the backend directly; every request rides the `/api` rewrite.
- **Icons, not emoji.** Every emoji v0 drew is a lucide glyph mapped by meaning in `frontend/components/site/icons.tsx`. Genres have no icon column: the glyph follows the slug. Owned genres keep an icon slug from a fixed set of 24.
- **Format is category.** The kind of talk a prompt asks for is `Topic.category`; v0 called it format. Same four values, same rules.
- **Owned genres are genre rows** (v0: packs in their own tables) and can be shared by link. §8.
- **Fewer tables and columns.** No `Genre.category` grouping, no `Topic.difficulty`, no `Session.topic_id`, no separate affiliates table, no login-session or password-reset tables of our own, static exchange rates.
- **Crawlable pages stay server-rendered.** The growth plan is the ten genre pages, so they are rendered on the server with every topic in the HTML, as v0's were.

---

## 3. Topics

### Two axes

A topic is a sentence with two labels:

- **Genre**: what it is about. The visible picker.
- **Category**: how you are asked to talk about it. In settings, defaulting to "Surprise me".

Category is a tag on a topic, never a transformation of one. "Tipping should end" is stored as a hot take; "Low tide" as just-talk. Filtering narrows the bank; nothing rewrites a prompt.

### Ten genres, one flat list

General, Everyday life, Relationships, Career and work, Money and business, Tech and AI, Science and climate, Health and mind, Philosophy and ethics, Culture.

Shipped as twenty in v0 and cut to ten on 5 September 2026. A flat scroll list stops working somewhere around fifteen, which is exactly why ten needs no shelves: there are no category headers in the picker, no search box and no blurbs (ten names fit on one screen and name themselves). The blurb earns its place on the genre page, where somebody arriving from a search engine has to be told what they landed on.

**Merged, never deleted.** The ten that went took their topics into the ten that stayed: food and travel into Everyday life; productivity into Career; personal finance and startups into Money and business; climate into Science; fitness, mental health and psychology into Health and mind; ethics into Philosophy; history, film and TV, anime and manga into Culture. The bank is still 800; genres hold between 40 and 120 each, and 40 is the floor. Anime and manga was the one contested call and is the first to split out again if genre pages earn their traffic.

Removing a built-in genre from the seeder's list deletes its row once its topics have moved off it; one that still owns topics is deactivated, never deleted with them. `Session.genre_slug` on finished runs is a plain string with no foreign key, so history stays readable through a merge.

### Four categories, and Surprise me

Surprise me (the default, and not a category: it means no filter), Just talk, Hot take, Explain it simply, Tell a story.

Cut from twelve on 5 September 2026. The four are four modes - open, argue, teach, tell - and that is the test a fifth has to pass. Anything naming an occasion (an interview, an exam, a club) is a context, and a context is a genre or somebody's own genre. The topics that carried a removed category were retagged, never deleted. **Every built-in category appears in every built-in genre**, or it is a chip that silently does nothing; the seeder test holds that.

A coined category exists only under an owned genre (§8).

### The bank

800 topics across the ten genres, one JSON file per genre in the backend, loaded by an idempotent seeder that owns every column it touches on built-in rows, upserts by text, never deletes a topic (`is_active` off instead) and never reads past `owner IS NULL`. It is a management command, not a boot step. Text and slug are unique per genre, not globally, because two owners may both write the same sentence.

Written global-first. Every "new topic" click is instant because the whole bank ships with the page and is shuffled in the browser; the no-repeat pool hands nothing back until it is exhausted, and a thin filter still gets a full spin by borrowing decoys from the genre and then the bank.

### There is no page per topic

`/topic/<slug>` was 800 pages carrying one sentence each, and it is gone. A search engine does not promote a thin page, and 800 of them do not add up to one good one: each held a sentence already printed on its genre page, and being near-identical to 799 siblings they competed with each other and with the ten pages that can rank. Four things follow:

- The genre page is the only place a topic is readable, so the ten of them carry the whole bank as text, and a test asserts every topic's text is on its genre page.
- `/topic/<slug>` answers 404, not a redirect. A redirect is a promise to resolve 800 slugs forever off a table whose rows may move genre and retire.
- `/?topic=<slug>` survives: it hands somebody one exact prompt and skips the spinner. "Recently practised" on a share page points at it.
- The sitemap lists home, `/genres`, `/pro`, `/affiliate`, the paperwork and the ten genre pages: a hint about which pages route into the tool, not an inventory. No topics, no share pages, no operator paths.

`/genres` is the hub that links all ten and is load-bearing: the footer links it rather than six genres, so every genre page stays one hop from every page without eight hundred links to six of them.

---

## 4. The round

Six phases on the home page: **idle** (the one question and the one button), **spin** (the reel), **topic** (the prompt, the controls), **prep**, **speak**, **done**.

- **The spin** is a slot-machine reel: decoys scroll past and settle on the winner with an ease that overshoots and rebounds. It is the moment of no take-backs, and the most filmable thing on screen. Reduced motion skips it; the settle is backed by a timeout so it can never be lost.
- **Prep**: a countdown and three sticky notes, because that is what the reference creators physically did. Notes are capped at 80 characters so they hold keywords, not sentences, and are tilted so they do not read as buttons. "Speak now" skips prep entirely.
- **Speak**: the ring timer is the centrepiece, large, with tabular numerals. The notes are echoed read-only as chips. "Done" stops early and still records the run: finishing early is data, not a failure.
- **Done** says what the round was worth: day N of the streak, topics, minutes. That is the whole retention loop, and it is free to compute.
- **Settings**: prep from 0 to 30 minutes and speak from 1 to 10 minutes, in one-minute steps, both defaulting to a minute; a long prep is how "deep research" is covered without a mode. Sounds: decelerating reel ticks spaced by inverting the reel's own ease, a settle ding, a metronome tick per second while speaking, an end chime. Settings persist in the browser. The settings sheet vanishes mid-round: a settings panel is exactly the escape hatch a nervous speaker would take.
- **The clock is wall-clock**, never tick-counting, so a throttled background tab cannot gift extra time.
- **A round that hides its chrome owes you a way out**, and it sits in the row with everything else you can press. A back arrow leads the button row in prep and speak and again in topic. It goes back one step, never to idle: the topic and the notes survive and the header returns. Escape does the same and is read before the textarea guard, because prep is where somebody is typing. The arrow leaves and keeps nothing; Done keeps the run; the two sit a tap apart in speak and the arrow's label says so there. The mark is drawn, not typed: no font on the site has a "<-".
- **Keys**: space starts and pauses, N gives a new topic (the first letter of the thing it does, and R is what every browser has already given to reload).
- **Camera mode**: during prep and speak the header, footer, hints and the support bubble are hidden. The frame is a laptop screen shot from across the room.
- **The staged topic** is per browser, not per account: a genre and the words under one localStorage key, read and cleared by the next draw, with the spin left intact so only the winner is fixed. Two people filming off one login do not stage over each other, and a rigged reel is never written down beside anybody's real runs. It is written by the operator tool and read by the engine; a key one of them cannot read is a button that looks like it worked.
- **A finished run is one POST** with the topic text, the genre slug, the category, the prep and speak lengths, how long was actually spoken and the browser's UTC offset. Rate limited per device, not per address: a classroom behind one address is many speakers, and nothing may stand in front of the practice loop.

The engine is a pure TypeScript module with no DOM in it, tested with fake timers; the page renders its state.

---

## 5. Streak

**Derived, never stored.** A stored counter drifts the first time a timezone, a retry or a clock change surprises it; counting distinct days back from today costs one indexed query and can never disagree with the sessions table.

- **Days are the visitor's own local days.** The browser sends its UTC offset with every run, and a round finished at 11pm on Tuesday counts as Tuesday for the person who spoke, whatever the server thinks.
- **Whose runs count.** An account spans devices. A device that has not signed in sees only its unclaimed runs, so signing out does not keep showing history the account now owns.
- **Freezes are a counting rule, not an inventory.** A Pro streak survives two missed days a calendar month. No table, no balance, no SKU, nothing to build a "two left" control for. All or nothing: a gap that cannot be paid for in full spends nothing. Buying Pro repairs the gaps already behind you, because the answer was always derivable and only the rule changed. [`PRICING.md`](PRICING.md) §6.
- **The flame is the only door to `/streak`.** The pill is a flame and a digit, the sentence in the title and the aria-label, absent until there is a streak.
- **`/streak`** shows the current streak, lifetime totals, and two calendars, eight weeks and a year, a week per column with time running left to right so the last column is the week you are in. Both windows are whole weeks (56 and 371 days) ending today.
- **Sharing** is one nullable token on the account: 16 random bytes, minted once, never rotated. `/s/<token>` shows the stats and recently practised topics (linking `/?topic=`), no account needed, `noindex`. There is no off switch on the site, on purpose: the page exists to be shown, and it carries nothing that is not already public or already theirs. A regretted link is cleared by hand in the admin for somebody who writes in.
- **The retention report** counts day-2 and day-7 return as cohorts off the sessions table, in UTC days (a cohort is a population, not a person), as a management command. It is what analytics gets checked against, and it keeps working when an ad blocker removes somebody from analytics.

---

## 6. Accounts

- **Email and password**, minimum eight characters and no other rule. Django's own user, sessions (30 days, HttpOnly, SameSite Lax, cookie `impromptu_session`) and Argon2 hashing. A form that refuses re-renders with one sentence and the typing intact, never a bare 422; only a value no person could have typed is refused at the edge.
- **The anonymous device is claimed** on both doors: every run carrying the current device id and no user gets the user set. A device with anonymous history signing into an account with its own history keeps both. Signing out rotates the device cookie so nothing is left behind.
- **`?next=` is honoured** after sign-in, for our own paths only.
- **Password reset** sends one link, valid for an hour; only the newest works; a successful reset ends every session. Mail goes through the transactional provider, and every non-production environment prints it to the console instead.
- **Google sign-in is a second door, not a second system.** It ends where the form ends: one user row, the same session, the same device claim. It lives on `/login` and `/signup` only, never on the home page or in the menu. It fails closed where the captcha fails open, because an unreachable Google handled leniently signs somebody in as an account they have not proved they own. A verified address links to the existing row rather than making a second one; `google_sub` is matched first because it survives a change of address; a Google-only row has no password rather than a placeholder; `?next=` travels in the signed state because the redirect URI is one fixed string.
- **reCAPTCHA v2** sits on the open forms (signup, login, forgot) and fails open: an unreachable verifier degrades to the site as it was before the captcha existed. The public key reaches the page only when both keys are set.
- **Rate limits**: sign-in 10 per 15 minutes per address and 5 per account; reset 5 per hour per address and 3 per email; signup 5 per hour; runs 120 per hour per device; checkout 10 per hour. A refusal is a 429 with Retry-After, and the right password is refused once throttled, or the limit is decorative.
- **`/account`** holds account, email and subscription as sections; `/account/additional` holds the colour (six accents, Pro only), "sign out everywhere" and the rest. Anything new is a section on a page, not a menu entry.
- **The account menu holds destinations, not features.** Signed in: name or email, Settings, Affiliates, Administration (superusers only), Get Pro (unless Pro), Sign out, and the theme as three stops shown at once. Signed out: Create an account, Sign in, Pro, Affiliates, theme. A feature goes where its intent fires: owned genres at the picker, freezes beside the streak. There is no features page; that is the thing you build once you have lost this argument.

---

## 7. Pro

What is for sale, what stays free, what was rejected and why are in [`PRICING.md`](PRICING.md). The short version: four plans (monthly, annual, a thirty-day pass, lifetime), two shapes; the streak, unlimited runs and every built-in genre are free forever; Pro keeps the full history, makes owned genres, and gets the freeze rule and the colour.

---

## 8. Owned genres (v0: packs)

Where a stranger feels "these do not fit me" is while choosing a genre, so the way in sits in the picker under **Yours**. Where that group sits is the one thing Pro changes there, and the condition is Pro alone: with Pro it leads, own genres first and the editor's door riding with them; without it the same group sits last, under the ten, because making one is behind the paywall and a heading at the top would be selling rather than picking. It is never removed: a stranger discovers the feature the same way, `/packs` is the honest place to ask them to sign in, and a lapsed subscriber keeps their genres.

**In v1 an owned genre is a `Genre` row with an owner and its topics are `Topic` rows.** v0 kept packs in tables of their own because the bank is public and the seeder must not learn to skip rows; sharing makes an owned genre public by intent, and the seeder's rule is one `owner IS NULL` clause pinned by test. This removes a second table pair, the `pack:` namespace and a second picker row shape. Recommended on 6 September 2026; the owner confirms when card 29 starts.

- Name, slug unique per owner (so two people can both have "work" and nobody can shadow a built-in), an icon from the fixed set of 24, `is_active`, a share token. Ten per account, 200 topics each, because the bank ships inline.
- **A coined category** exists only here. `Topic.category` holds a built-in slug or the words typed, at most 24 characters, stored as typed and never slugified, because "IELTS style" read back from a slug is "Ielts style" and a tag that restyles itself is a tag nobody trusts. Typing a built-in's name gets the built-in. A paste cannot coin one, or every comma in a sentence would. It is filterable only inside the genre that coined it; leaving the genre drops the filter back to Surprise me; analytics records "custom", never the words.
- **Editor**: add topics by paste (a category tag parsed off each line), edit text and category inline, delete a topic, share on and off with the link to copy, delete the genre.
- **Generate** five topics at a time from a prompt with a model, behind a monthly allowance counted from rows (§6 of `PRICING.md`). Off entirely without a key; the rest of the editor works without it.
- **Sharing** (new in v1): "Share" mints the token once; "Stop sharing" clears it and the old link dies. `/g/<token>` is `noindex`, needs no account, shows the icon, name, owner's name (never the email), every topic with its category, and "Practise this", which puts the genre in the picker for that visit. Viewing is free, making is Pro, nothing is copied: a link always shows the current list.
- **Anything a person picks is a fixed set with a validator in front of it**: the accent, an icon, a category. Offer a list and turn anything unrecognised into the default rather than raising, because these values end up in an attribute on `<html>`, in the picker and in a filter, and the one thing they must never be is whatever was posted.

---

## 9. Affiliates

Every account has a link, `impromptu.talk?ref=<code>`, minted on the first look at `/account` or `/affiliate` and never changed, and it earns 30% of what a purchase actually charged. The rules are in [`PRICING.md`](PRICING.md) §7. `/affiliate` is the pitch and is public; `/affiliate/referrals` is one person's own numbers and is not.

---

## 10. Administration

Two consoles, and they are not the same thing. **`/re-admin/`** is Django's admin over every table, opened by `is_staff`; it is the owner's console and the only place a purchase, a refund or a share token is edited by hand. **`/administration`** is a grid of operator tools that act on the browser in front of them, reached with the ordinary session and opened by `is_superuser`. Nothing on the site raises either flag.

- **The gate answers 404**, to a stranger and a signed-in speaker alike. A 403 confirms the path was guessed right; a sign-in prompt is the same confirmation with a form on it. The Next proxy does not gate it for the same reason.
- **A grid of cards, not a menu.** A tool is a place you go and do one thing: the staged topic; Pro by hand (a gift filed as a complimentary plan, never as a lifetime row priced at nothing, and taking one back refuses any row that took money); affiliate payouts (rows an operator writes after the money moved); outreach (the message to a creator, addressed and ready to copy, and who has had it; the rate in it is read off the same constant settlement pays).

---

## 11. Analytics and support

- **PostHog** with a token only in production. The distinct id is the device, because it is what runs join on and the only id somebody has before they sign up; a signed-in address rides on identify as a property, never as the id. Autocapture is off; every event is an explicit call. Session replay is on because two masks make it allowed: every input masked by default, and the class the prep notes carry into the speak phase masked by selector, since chips are not inputs. A mask naming a class nothing carries fails silently, so a test pins the markup and the privacy page states the behaviour.
- **Crisp** draws the support bubble on every page except the home page, which is the tool, and hides with the chrome while filming. Signed in, the address rides on the session so a recording can be put to a person who wrote in.
- **Slack** is told the six things somebody would act on today (`PRICING.md` §9).

---

## 12. Chrome and pages

- **Header**: the die and the wordmark, "impromptu" in ink and ".talk" in the display face at 400, collapsing to "i.t" on a phone; the streak pill; the account menu. The band runs full width and carries the hairline; the row inside stops at 80rem.
- **Footer**: the brand column (wordmark, blurb, copyright with the owner, which is the company name or the site's own when there is none), then Product (All genres, Your streak, Pro), Company (About, Contact, Affiliates, the contact address), Legal (Privacy, Terms, Refunds). The bottom line differs by sign-in state: a stranger is told no account is needed and their streak lives in this browser; somebody signed in is told something else, because by then their runs are rows on our server. "Proudly made in India" is addressed, not broadcast: shown to a visitor in India and to nobody else, and no signal means no line.
- **Where a visitor is** is answered in one place off three signals, best first: a country header when a proxy sets it, the timezone cookie a script writes before first paint, the region of Accept-Language. It answers which of the eight markets, never where on earth.
- **Errors are pages.** A dead URL or a 500 outside `/api` is a page of ours, status kept, with the one true sentence and the tool's button on it. Never a JSON blob for a visitor who expected a page, and never a soft 404 that gets a dead URL indexed.
- **Metadata**: every page writes a title and a description once and the canonical, the Open Graph card and the Twitter card follow; one image for the whole site, rendered by hand from `docs/assets/og-card.html`.
- **Static pages**: about, contact, privacy, terms, refunds. Plain running text in a narrow measure. Each is written against what the code does and moves with it in the same commit.
- **Theme**: system, light or dark on `<html data-theme>`, applied before first paint from the same key v0 used, chosen from the menu. Dark moves the accent up the same ramp: olive on paper, lime on near-black.

---

## 13. Type, colour, weight, the mark

- **Type**: Bricolage Grotesque for display, narrowed to wdth 96 so a long topic loses width before it drops a size; Plus Jakarta Sans for everything you read. Self-hosted, one variable file per family per subset, the latin files preloaded. The topic is the single most important element on the site and is sized for a phone filming a laptop. Weights are read off computed styles, not the stylesheet: the ".talk" is the display face at 400, and narrowing the file would silently thicken it.
- **Colour**: the accent is the topic and the button is ink. The accent colours what you read (the topic, the flame, links, focus rings, a filled calendar day); the primary button is ink in light and off-white in dark and its colour never moves, not between idle and mid-round and not when somebody picks a different accent. A colour is a hue and a chroma; the theme owns the lightness, so no choice among the six accents can make the topic unreadable, and a test reads the stylesheet and holds every one above 4.5:1 on both pages. Controls take a stronger hairline than list rows because a 1.3:1 border is one nobody can see.
- **Weight**: v0's cold first visit was 209KB with the 800-topic bank inline and the fonts at 159KB. v1 measured 358KB on the day the chrome landed, the difference being framework script; the number lives in `DECISIONS.md` and the parity doc, and chasing it is a card of its own.
- **The mark**: a die seen from a corner showing 1, 2 and 3, the three faces you can ever see at once and the three that total six. It draws the roll, not the clock, because the clock is the part people are already afraid of and the roll is the promise that you do not have to think of anything. One colour on `currentColor`, 32 viewBox, 2.2 stroke, round caps. In the header the die is the accent and the name is ink. The favicon is a drawn opaque tile at 16, 32 and 48; the apple icon is the pale cut, because iOS composites onto black.
- **Naming**: plain nouns in filenames, identifiers and classes. No metaphors, no trade jargon. If a name needs the codebase explained before it reads, it is the wrong name.

---

## 14. Deferred, and never

Once the gate is passed, roughly in this order, and each earns its place only if the loop is retaining: the microphone and the deterministic delivery report (pace, fillers, pauses, energy and trail-off, structure, focus, one transparent score; free, no model, multilingual-ready from day one); model-based critique of the argument (paid, via OpenRouter, fed the deterministic report so it never contradicts the score); share cards; framework beats across the speaking clock; a follow row so a shared genre stays in your picker and a public index of shared genres; a studio for coaches; rooms.

Never: camera recording, video export, leaderboards, a social feed, audio storage.
