# Pricing and Pro

What is for sale, what must stay free, what was rejected and why. Carried over from v0, where these decisions lived across `CLAUDE.md`, `plans.py`, `pricing.py`, `purchases.py`, `streaks.py` and `affiliates.py`, and updated for v1. If you are about to decide pricing, tiers, what goes behind a paywall or what the free tier includes, the answer is probably here. If it is not, add it here in the same change.

Prices and rules are code, reviewed like code. Env holds only the provider's keys and product ids.

---

## 1. What is for sale

Four plans, two shapes:

| Plan | Price | Shape | Grants |
|---|---|---|---|
| Monthly | $5 a month | subscription | Pro until the next renewal |
| Annual | $29 a year | subscription | Pro until the next renewal |
| Pass | $8 once | one-time | thirty days of Pro |
| Lifetime | $39 once | one-time | Pro for as long as the site exists |

The difference between the shapes is what it takes to believe somebody has Pro. A one-time payment settles once and is true afterwards: the row is the whole proof. A subscription is only true until the next renewal, so its entitlement carries an expiry that is re-read from the provider rather than remembered.

- **The pricing page is two cards**, one per shape, each with a pill switching between its two plans. The first plan of each shape is the one a card opens on. The pass is called "Monthly" like the subscription's first plan, on purpose: both pills name a duration, and the card above them says whether it renews.
- **Lifetime was rejected once and is on sale**, reinstated by an explicit call. It is safe because the marginal cost is zero (history is rows we already store) and because the monthly allowance in §6 bounds the rate a buyer can spend rather than the purchase. It sits close above annual so it is the obvious pick, and **annual may never price at or above it**.
- **Two more plans are given, not sold**: complimentary forever and a complimentary month, what an operator hands out at `/administration/pro`. They are plans rather than a lifetime row priced at nothing, because the plan is what an account page prints and what revenue is counted off, and a gift filed as a sale is a number somebody has to correct by hand. Neither has a product id, which is the same thing that switches a real plan off, so neither can reach a checkout.
- **A plan is on sale only when both the provider key and its product id are set.** Missing either leaves the card reading "not open yet" rather than half-working. With no key at all, Pro is not linked from the menu or the footer.

**Pro is**: the full practice history, owned genres and their sharing, the streak freeze rule, the colour, the model-generated topics allowance.

---

## 2. Free forever, and what was rejected

**Free forever: the streak, unlimited practice runs, every built-in genre.** Each has a reason, and "we need revenue" is not a good enough argument to reverse any of them.

- The streak is the funnel, not the product. The reference product in this space converted a tenth of its users with the streak entirely free, and its operating rule is that any monetisation change that hurts retention is rolled back. Sell the freeze, never the streak.
- Unlimited runs, because the loop is the whole product and a run costs nothing to serve.
- Every built-in genre, including any exam or profession genre that ever exists, because those pages are the growth engine. Paywalling them would block the best search channel the site has.

**Rejected**: paywalling the streak; paywalling exam or profession genres; gating history by deleting it (gate the view, never the data); **Interview Week** (a one-time deadline product: dropped on simplicity, because a box that bounds a purchase is worse than an allowance that bounds a rate, §6); a streak-freeze inventory (§6); our own cancel button (§5); webhooks (§3).

**The paid move on content is creation, not access.** Free uses any built-in genre; Pro makes and shares its own.

---

## 3. The price is a log line, not a gate

Polling, not webhooks. Opening a checkout writes a pending purchase row and hands the buyer to the provider's hosted page; coming back, the payment is read from the provider's API and that read is the only thing that can move a row to paid. Nothing a browser says is trusted: the return URL carries ids, and every claim attached to them is thrown away and re-read.

- **Binding** is what stops one payment being spent twice. An arriving payment has to carry our reference in its metadata and name the checkout session this row opened. A payment id lifted from somebody else's return URL satisfies neither.
- **The price is not one of the bindings.** A payment the provider calls succeeded, with our reference and our session, grants Pro. What it cost is written beside what we quoted, charge against quote in each's own currency, and a disagreement is a log line and a Slack line, because by then the money has moved and refusing would take the buyer's money and hand them a page saying they did not pay.
- **The two numbers disagreeing is information.** Different currencies means the buyer switched in the provider's modal; the same currency with a different number means a dashboard product has drifted from the price table.
- **A subscription cannot report its charge**; its recurring amount is the product's pre-tax figure. The payment behind it is the bank statement, and it is read separately.
- **Two questions are kept apart.** `status` answers "did the money land"; `expires_at` answers "is the access it bought still good". A subscriber whose card failed is still a paid row; their entitlement has run out.
- **Receipts** go out as mail after the row settles and never block the grant; a mail failure is a log line.

---

## 4. Currencies

One price per plan is stored, in USD cents, and every other one is derived at read time from two numbers: the exchange rate (the honest half) and a purchasing-power multiplier (the deliberate half). Rs 3,400 is what $39 converts to and is not what $39 means in Delhi, so the rate is discounted rather than applied straight.

| Currency | Country | Rate | Multiplier | Rounds to |
|---|---|---|---|---|
| USD | US | 1 | 1.0 | $1 |
| EUR | DE | 0.86 | 1.0 | 1 |
| GBP | GB | 0.74 | 1.0 | 1 |
| INR | IN | 88 | 0.33 | 50 |
| BRL | BR | 5.40 | 0.48 | 5 |
| PHP | PH | 57 | 0.38 | 50 |
| MXN | MX | 18.5 | 0.52 | 10 |
| ZAR | ZA | 17.8 | 0.45 | 10 |

- The euro and sterling carry a multiplier of 1.0 and convert straight, because discounting a market that is not poorer than the one the price was set in is not purchasing-power pricing, it is a sale. The multipliers are editorial, in the neighbourhood of the purchasing-power conversion factor over the market rate, rounded to something a person picked on purpose.
- Derived prices land on a round number in major units, because nobody prices anything at Rs 551.76.
- **Rates are static in v1.** v0 could fetch live rates; nothing needed that, so v1 keeps the table until a reason appears.
- The picker shows five currencies at once, the most likely first, with the one in use always among them. The default is chosen by where the visitor is (`SPEC.md` §12): a country header, the timezone, the language region, in that order, and USD for everybody the table does not name. The euro's default billing country is DE, and the checkout lets the buyer correct it.
- The provider takes amounts in the currency's smallest unit, and not every currency has two decimals; the exponent is per currency.

---

## 5. Subscriptions and the portal

**Stopping a subscription is the provider's portal, not a button of ours.** The subscription section of `/account` opens a portal session and redirects. Cancelling, a new card and past invoices are all behind that one link; our own cancel button would have been one API call and would still leave an expiring card with nowhere to go.

- **The provider's customer id is a column** because it is not ours to derive: it exists only on a payment or subscription at their end. It lands with the settlement on new rows and is backfilled lazily on old ones, the first time that account opens the portal.
- **The click writes no entitlement.** A cancellation keeps the period already paid for, so the expiry is untouched and Pro runs out on the date it was always going to.
- **A cancelled subscription is still active**, which is the promise and not a bug, so "cancels at the next billing date" is its own flag rather than a word in the status. Without it the page announces a renewal on a date the provider has been told never to charge.
- **Entitlement is refreshed lazily**: only after the stored expiry has passed, and once more on the way back from the portal, because those are the two moments the answer can have changed. An ordinary visit by a live subscriber costs zero API calls. Still no webhooks.
- **Expiry** is null for lifetime, a fixed date for the pass, and the provider's next billing date plus a grace window for a subscription.

---

## 6. The rules behind Pro

**Streak freezes are a counting rule, not an inventory.** A Pro streak survives two missed days a calendar month. Two covers a weekend away, which is what people actually lose streaks to; per calendar month rather than per streak, so a long streak keeps being forgiven; small enough that practising every other day still breaks, which a streak that never breaks would not be worth having. There is no table, no balance and no SKU, because an inventory that can be spent, refunded, granted and drift out of step with the runs it protects is exactly the stored state the streak code exists to avoid. It cannot disagree with the sessions table, buying Pro repairs the gaps already behind you, and there is nothing to draw a "two left" control for.

**Lifetime is safe because of the allowance.** History costs nothing at the margin, and the one thing that costs per use is metered below, so a $39 buyer's spend is bounded by rate and not by purchase.

**Anything that costs per use goes behind a monthly allowance, counted from rows.** Five model generations an account a calendar month is the first one; a failed call still spends one, or a retry loop is free. Never a stored counter. Spending the fifth is the design working, not an event anybody is told about.

**Owned genres**: making one is Pro; using any built-in genre, and viewing a shared one, is free. Ten per account, 200 topics each. The Yours group sits first with Pro and last without, and is never removed (`SPEC.md` §8).

**The colour**: six accents, Pro only while paying. A lapsed subscriber keeps the row and gets the default back until they return, because cancelling is not the same as changing your mind about a colour.

**Pro given by hand** is a tool at `/administration/pro`, not eight fields in the admin: it writes a purchase whose plan is complimentary, forever or for a month, and taking one back refuses any row that took money. That is a refund, and a refund starts at the provider and finishes in the admin with the line in the channel that goes with it.

---

## 7. Affiliates

Every account has a link and it earns **30% of the charge**. It was a fifth for part of 6 September 2026 and was raised the same day.

- **The code** is lowercase letters and digits, 2 to 24 characters, minted from the name or the address with a numeric suffix when the stem is taken, on the first look at `/account` or `/affiliate`, and never changed. Its shape is the whole of what is trusted in a URL; whether it exists is decided at the two moments it is spent.
- **The cookie** is `impromptu_ref`, set by the frontend proxy from `?ref=` on any GET, sixty days, last click wins. It is spent twice and nowhere else: at signup, which writes `referred_by` on the account and freezes it forever, and at checkout, where the account's own referrer wins over the cookie and the cookie is the fallback for a buyer who had an account before they clicked anything. Nobody is ever credited with themselves.
- **Commission is 30% of `usd_value_cents`, off the charge, never off the list price.** A Rs 1,150 lifetime is thirteen dollars, and 30% of thirty-nine would be nearly the whole sale. Written onto the purchase at settlement and frozen there.
- **The balance is derived**: commission over paid purchases less payouts. No balance column. A refund flips the purchase's status and the number drops; nothing has to hear about it.
- **Referrals point at the user**, not at an affiliate row; there is no affiliates table in v1, only `affiliate_code` and `paypal_email` on the account.
- **Nobody is named to their referrer.** "New account" and "Lifetime bought", dated; never an address.
- **`/affiliate`** is the public pitch, with the rate read off the same constant settlement pays and three sample faces that say they are samples. **`/affiliate/referrals`** is one person's own events and balance, and where they set a PayPal address.
- **Payouts are rows an operator writes after the money moved**, from `/administration/payouts`, PayPal only, from $10. The tool refuses more than the balance.
- **The outreach message** to a creator prints the same rate, pinned by test, because a DM promising a number settlement does not pay is the first thing a creator would catch us in.

---

## 8. Refunds

Seven days, no questions. Ask within seven days of a payment and it is refunded in full. After seven days, ask anyway: Pro is a record of practice you did yourself, not a download, and if it has not been worth it, say so. A paid feature that does not do what its page said is a refund whenever you notice it. Cancelling a subscription stops the next charge and keeps the period paid for. Requests go to the contact address with the checkout email and the payment date, are answered within three working days, and the money goes back the way it came. The provider is the merchant of record and handles tax across every country it sells in; refunds are done at the provider and recorded in the admin, and the channel hears about each one.

---

## 9. What the channel is told

Slack is told the six things somebody would act on today: a signup, a settled payment, a dead payment, a refund, a cancelled subscription, a price mismatch. The test a seventh has to pass is "would somebody do something about it today?" A finished round fails it; so does an account spending its fifth generation. A channel that reports normal operation gets muted, and a muted channel does not deliver the cancellation either.

- The notifier never raises and nothing depends on it; every caller sits after a committed row.
- A cancellation is the flip, not the state, read before the refresh overwrites it, or every trip back from the portal would announce the same churn again. It is also the one event nothing else could surface, because there are no webhooks.
- The webhook URL is the credential and the channel at once and never reaches a log. Blank turns the events into log lines; anything but production labels its own messages, so the channel can be tested from a laptop.
