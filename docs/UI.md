# UI

The rebuild is the chance to improve every screen, and this is the record of it. Behaviour, rules and copy come from v0 and `SPEC.md`; the look does not. Before a card builds a surface, a standalone mock of it lands under `docs/mocks/` as one HTML file that opens on its own (real tokens, real type, the light and dark themes, a phone width), the owner approves it, and the row below is filled in. A surface without an approved mock is not built.

What every mock has to keep: the ten-second rule (home is the tool, near-zero words, one primary button, everything else behind the account menu), the tokens in `frontend/app/globals.css` (the accent colours what you read, the button is ink), lucide glyphs, and type sized for a phone filming a laptop.

| Surface | Cards | Mock | What improves over v0 | Status |
|---|---|---|---|---|
| Home and the round (idle, topic, prep, speak, done) | 08, 11, 12, 13 | `mocks/home.html` | Idle keeps v0's shape (chip and gear above the question, the question in the accent stating the speaking length, one button that says Spin). Inside the round: Reset as an underlined link under the buttons instead of a back arrow; Spin as a button carrying the die instead of a rotate icon; the primary button names the duration; one ring clock in the same place for thinking and speaking, warm in the last ten seconds; notes become chips; done is three tiles with Spin again leading; wider spacing throughout. Built on cards 08, 11 and 12 with two copy calls logged in DECISIONS: the done headline follows v0 ("Day N." or "Nice."), and the speak screen's Reset says it keeps nothing. | approved 2026-09-06, built; the two sheets (last two mock tabs) built on card 13 and added to the mock after, awaiting a word |
| Genres hub and genre page | 09 | `mocks/genres.html` | Hub as ten cards with the topic count on each and one button into the tool; the genre page groups topics by style under real headings, two columns on a laptop, one button that opens the tool with the genre picked, More genres at the foot. | approved 2026-09-06 |
| Chrome: header, account menu, footer | 05 | in both mocks | As built on card 05: the die and wordmark, the streak pill, the account button; footer with the owner and three columns. | approved 2026-09-06 (as part of both mocks) |
| Streak page | 17 | `mocks/streak.html` | The three tiles are the done screen's tiles, so the page the flame opens looks like the screen that sent you. Free gets a five-day strip of named days (the rule is five days) rather than a five-square heatmap; the year heatmap is Pro's, with a dashed square for a day the freeze held and the month names over the columns. Recent shows the genre glyph beside the time. The pitch is one sentence, only when true. Share sits after the primary button. One column at 960px, the genre page's frame. List lengths in the mock are shortened; the real caps are 25 runs free and 1000 Pro. | approved 2026-09-07 with two changes by the owner: the tiles are a three-column grid that never wraps two and one, with no glyph on any tile; every line of copy is one short sentence in plain words. Built on card 17. |
| Share page | 18 | `mocks/share.html` | The streak page's shape seen by a stranger: the same label, headline, three tiles and heatmap, with no pitch, no times and no footer line. Three tiles rather than v0's five. Eight weeks for everybody, its own constant. Only bank topics named, each a link into a round. The name if given, never the email. One button, "Try one yourself", then the tagline. | awaiting approval, 2026-09-07 |
| Sign up, sign in, forgot, reset | 19, 20, 21, 22 | | | not yet mocked |
| Account pages | 23 | | | not yet mocked |
| Pricing page and checkout | 25 | | | not yet mocked |
| Owned genres: list, editor, shared page | 29, 30 | | | not yet mocked |
| Affiliates | 31 | | | not yet mocked |
| Administration | 32 | | | not yet mocked |
| About, contact, legal | 33 | | | not yet mocked |
