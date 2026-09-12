import { Button } from "@/components/site/button";
import { ChevronRightIcon, PlusIcon } from "@/components/site/icons";

/* The Pro half of a warm-up: your own passages on the scroller.

   Which is what a coach, a teacher or one of the creators this feature was
   built from actually wants - their script, not ours. It is also the rule
   `PRICING.md` §6 already sets and needed no new pricing decision:
   **creation, not access**. Every built-in passage is free at every
   difficulty, forever, because the hard ones are exactly the rows worth
   filming; what is sold is writing your own.

   The row routes by what the visitor already is, and the order matters:
   a stranger is sent to sign in *on the way to* Pro rather than to a
   checkout they cannot complete, and somebody signed in who has not
   bought it goes straight to the page that sells it. Nobody is shown a
   paywall they have already paid. */
export function MakeYourOwn({ signedIn, isPro, path }: { signedIn: boolean; isPro: boolean; path: string }) {
  /* `?next=` is honoured for our own paths only, which is why this is one
     of them: signing in from here lands on Pro rather than on home, so
     the journey somebody started is the journey they finish. */
  const href = isPro ? path : signedIn ? "/pro" : `/login?next=${encodeURIComponent("/pro")}`;
  const label = isPro ? "Write your own" : "Get Pro to write your own";

  return (
    <section className="mt-12 rounded-2xl border border-line bg-card px-6 py-6">
      <h2 className="font-display text-[26px] leading-tight font-semibold tracking-[-0.03em]">
        Your own tongue twisters
      </h2>
      <p className="mt-2 max-w-[58ch] text-[15.5px] leading-[1.55] text-muted">
        Paste your own passages and read them on the same scroller: a script you are rehearsing, the words your
        students keep tripping on, or a twister nobody else has. They stay yours, and they sit beside these in the
        settings.
      </p>
      <div className="mt-5">
        <Button href={href} size="lg">
          {isPro ? <PlusIcon size={17} /> : null}
          {label}
          {isPro ? null : <ChevronRightIcon size={16} />}
        </Button>
      </div>
      {!isPro && (
        <p className="mt-3 text-[13px] text-muted">
          Reading these is free forever, at every difficulty. Writing your own is the part that is Pro.
        </p>
      )}
    </section>
  );
}
