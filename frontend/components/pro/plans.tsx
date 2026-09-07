"use client";

import { useState } from "react";

import { CurrencyPicker } from "@/components/pro/currency-picker";
import { openDialog, OverlayScript } from "@/components/pro/overlay";
import { Button } from "@/components/site/button";
import { CheckIcon } from "@/components/site/icons";
import type { Card, Catalogue, PricedPlan } from "@/lib/api";

/* The plans, as approved in docs/mocks/pro.html: two cards over one list.

   The cards are the choice and the list belongs to whichever plan is
   picked, because only two of its lines actually differ between plans.
   v0 printed the same seven-line list inside both cards, so a third of
   the page was the same words twice. */

/** Everything Pro holds. The first two lines are the picked plan's own
    numbers; the rest are the same on every plan, which is the whole
    reason this is one list under the cards rather than a copy in each. */
function holds(plan: PricedPlan, freeDays: number): string[] {
  const span = plan.tracks >= 365 ? "A year" : `${plan.tracks} days`;
  return [
    `${span} of streak, instead of ${freeDays}`,
    `${span} of history`,
    "Your own genres, with your own topics",
    "Share a genre by link",
    "Topics written for you, five batches a month",
    "Your pick of six colours",
  ];
}

export function Plans({ catalogue, signedIn }: { catalogue: Catalogue; signedIn: boolean }) {
  const cards = catalogue.cards;
  /* One plan is picked across both cards, and each card remembers which of
     its two it is showing, so switching cards does not undo a pill. */
  const [showing, setShowing] = useState<Record<string, string>>(() =>
    Object.fromEntries(cards.filter((card) => card.plans.length).map((card) => [card.kind, card.plans[0].code])),
  );
  const [pickedCard, setPickedCard] = useState(() => cards.find((card) => card.plans.length)?.kind ?? "");

  const picked = plansOf(cards, pickedCard).find((plan) => plan.code === showing[pickedCard]);

  return (
    <>
      {catalogue.selling && <OverlayScript mode={catalogue.mode} />}
      <div className="mt-[34px] mb-3.5 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-[23px] font-semibold tracking-[-0.02em]">Plans</h2>
        <CurrencyPicker currency={catalogue.currency} markets={catalogue.currencies} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <PlanCard
            key={card.kind}
            card={card}
            currency={catalogue.currency}
            showing={showing[card.kind]}
            picked={pickedCard === card.kind}
            signedIn={signedIn}
            onPick={() => card.plans.length && setPickedCard(card.kind)}
            onShow={(code) => {
              setShowing((was) => ({ ...was, [card.kind]: code }));
              setPickedCard(card.kind);
            }}
          />
        ))}
      </div>

      {picked && (
        <section className="mt-4 rounded-card border border-line bg-card px-5 py-[18px]">
          <h3 className="mb-3 text-sm font-semibold">
            What you get with <span className="text-accent-strong">{picked.name}</span>
          </h3>
          <ul className="grid gap-y-[9px] gap-x-[26px] sm:grid-cols-2">
            {holds(picked, catalogue.free_days).map((line) => (
              <li key={line} className="flex items-start gap-[9px] text-[14.5px] leading-[1.4]">
                <CheckIcon size={15} className="mt-[3px] shrink-0 text-accent" />
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-3.5 border-t border-line pt-3 text-[13px] text-muted">
            Free keeps the round, every genre, unlimited practice and a {catalogue.free_days} day streak.
          </p>
        </section>
      )}
    </>
  );
}

function plansOf(cards: Card[], kind: string): PricedPlan[] {
  return cards.find((card) => card.kind === kind)?.plans ?? [];
}

function PlanCard({
  card,
  currency,
  showing,
  picked,
  signedIn,
  onPick,
  onShow,
}: {
  card: Card;
  currency: string;
  showing: string | undefined;
  picked: boolean;
  signedIn: boolean;
  onPick: () => void;
  onShow: (code: string) => void;
}) {
  const plan = card.plans.find((one) => one.code === showing);
  /* Either nothing here is configured yet, or this account already holds
     it. Which one is the whole message: a card that goes quiet reads as
     broken. */
  const shut = plan?.refusal || (card.plans.length === 0 ? "Not open yet. Come back shortly." : "");

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <div
      onClick={onPick}
      className={`flex flex-col rounded-card border bg-card p-5 ${
        picked && !shut ? "border-ink shadow-[inset_0_0_0_1px_var(--ink)]" : "border-line"
      }`}
    >
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
        <p className="text-base font-semibold">{card.title}</p>
        {card.plans.length > 1 && !shut && (
          <Segment plans={card.plans} showing={showing} onShow={onShow} title={card.title} />
        )}
      </div>

      {shut || !plan ? (
        <p className="mt-[18px] rounded-[10px] border border-line border-l-[3px] border-l-ink bg-card2 px-3.5 py-3 text-sm leading-[1.45] font-semibold">
          {shut}
        </p>
      ) : (
        <>
          <p className="mt-[18px] flex items-baseline gap-[7px] font-display text-[clamp(2.3rem,5.5vw,3rem)] leading-none font-semibold tracking-[-0.03em]">
            {plan.price}
            <span className="font-sans text-[15px] font-semibold tracking-normal text-muted">{plan.unit}</span>
          </p>
          <Buy
            plan={plan}
            currency={currency}
            signedIn={signedIn}
            verb={plan.recurring ? "Subscribe for" : "Pay"}
          />
          <p className="mt-2.5 text-[13px] text-muted">{plan.note}</p>
        </>
      )}
    </div>
  );
}

function Segment({
  plans,
  showing,
  onShow,
  title,
}: {
  plans: PricedPlan[];
  showing: string | undefined;
  onShow: (code: string) => void;
  title: string;
}) {
  return (
    <div role="radiogroup" aria-label={title} className="inline-flex gap-0.5 rounded-full border border-line bg-card2 p-0.5">
      {plans.map((plan) => (
        <button
          key={plan.code}
          type="button"
          role="radio"
          aria-checked={showing === plan.code}
          onClick={() => onShow(plan.code)}
          className={`cursor-pointer rounded-full px-[13px] py-1.5 text-[13px] font-semibold ${
            showing === plan.code ? "bg-card text-ink shadow-[0_1px_2px_rgb(0_0_0/0.12)]" : "text-muted"
          }`}
        >
          {plan.name}
        </button>
      ))}
    </div>
  );
}

/** The button that starts a checkout.

    Signed out it is a link to sign in and back, because a checkout has to
    belong to an account before it opens. Signed in it asks our own route
    for a checkout and follows where it says. The overlay lands on card
    26 over exactly this: whatever fails, this button is what buys Pro. */
function Buy({
  plan,
  currency,
  signedIn,
  verb,
}: {
  plan: PricedPlan;
  currency: string;
  signedIn: boolean;
  verb: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!signedIn) {
    return (
      <Button href={`/login?next=${encodeURIComponent("/pro")}`} className="mt-[18px] w-full py-3.5 text-base">
        {verb} {plan.price}
      </Button>
    );
  }

  async function buy() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan.code, currency }),
      });
      const answer = await response.json().catch(() => null);
      if (!response.ok || !answer?.url) {
        setError(typeof answer?.detail === "string" ? answer.detail : "Could not open a checkout. Try again.");
        setBusy(false);
        return;
      }
      /* The dialog if the SDK is up, and the hosted page if it is not.
         Either way this is what buys Pro; the overlay only saves a page
         load. Busy is released on the dialog, which leaves this page
         standing, and held on the navigation, which does not. */
      if (openDialog(answer.url)) {
        setBusy(false);
        return;
      }
      window.location.href = answer.url;
    } catch {
      setError("Could not open a checkout. Try again.");
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={buy} disabled={busy} className="mt-[18px] w-full py-3.5 text-base">
        {verb} {plan.price}
      </Button>
      {error && (
        <p role="alert" className="mt-2.5 text-[13px] font-semibold">
          {error}
        </p>
      )}
    </>
  );
}
