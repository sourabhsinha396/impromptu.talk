import Link from "next/link";

import { FeatureIcon } from "@/components/site/icons";
import { FREE_FEATURES, PRO_FEATURES, type Feature } from "@/components/features/feature-list";
import { cn } from "@/lib/utils";

/* One badge reads on a card at a time: "Soon" beats "Pro", since a feature
   that is not built yet is not usefully described by who it will be sold
   to. Everything built and free wears no badge at all. */
function badge(feature: Feature): string | null {
  if (feature.soon) return "Soon";
  if (feature.pro) return "Pro";
  return null;
}

const BADGE_CLASS = "rounded-full border px-2 py-0.5 text-[10.5px] font-bold tracking-wide uppercase";

function Card({ feature, isPro }: { feature: Feature; isPro: boolean }) {
  const locked = feature.soon || (feature.pro && !isPro);
  const label = badge(feature);
  /* Locked on being Pro rather than on being unbuilt: the badge is the one
     live thing on an otherwise inert card, and it goes where the lock's
     answer lives. A Soon card has no such answer - nobody is selling it
     yet - so its badge stays a span even while locked. */
  const proBadgeLinks = locked && feature.pro && !feature.soon;
  const body = (
    <>
      <FeatureIcon slug={feature.slug} size={20} className={locked ? "text-muted" : "text-accent"} />
      <span className="mt-2.5 flex items-center gap-2 text-base font-semibold">
        {feature.name}
        {label &&
          (proBadgeLinks ? (
            <Link
              href="/pro"
              className={cn(BADGE_CLASS, "border-accent bg-accent/12 text-accent-strong no-underline hover:bg-accent/20")}
            >
              {label}
            </Link>
          ) : (
            <span
              className={cn(
                BADGE_CLASS,
                feature.pro && !feature.soon ? "border-accent bg-accent/12 text-accent-strong" : "border-line-strong bg-card2 text-muted",
              )}
            >
              {label}
            </span>
          ))}
      </span>
      <span className="mt-1 block text-[13px] leading-[1.45] text-muted">{feature.blurb}</span>
    </>
  );

  if (locked) {
    return (
      <span aria-disabled className="block cursor-default rounded-card border border-line bg-card px-4.5 pt-4.5 pb-4 text-muted">
        {body}
      </span>
    );
  }

  return (
    <Link
      href={feature.href}
      className="block rounded-card border border-line bg-card px-4.5 pt-4.5 pb-4 text-ink no-underline transition-colors hover:border-accent"
    >
      {body}
    </Link>
  );
}

function Group({ title, features, isPro }: { title: string; features: Feature[]; isPro: boolean }) {
  return (
    <div className="mt-9">
      <h2 className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">{title}</h2>
      <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3.5">
        {features.map((feature) => (
          <Card key={feature.slug} feature={feature} isPro={isPro} />
        ))}
      </div>
    </div>
  );
}

/* The page approved in docs/mocks/features.html, and logged in
   docs/DECISIONS.md as an explicit override of AGENTS.md's "there is no
   features page": as separate capabilities pile up (image topics, owned
   genres in two shapes, the streak, the model-written case) a stranger
   needs one place to see the shape of the whole product without ten
   spins.

   Free forever leads, always, and the order does not move for a
   subscriber (owner's call). The genre picker reorders for Pro because
   the group it promotes is somebody's own genres - their things, which
   they came for. Nothing here is anybody's; it is the same list of what
   the product does either way, and a page that rearranges itself once
   you have paid makes the reader re-find their bearings for nothing. */
export function FeaturesPage({ isPro }: { isPro: boolean }) {
  const groups = [
    { title: "Free forever", features: FREE_FEATURES },
    { title: "Pro", features: PRO_FEATURES },
  ];
  return (
    <main className="mx-auto w-full max-w-[960px] flex-1 px-[clamp(16px,4vw,32px)] pt-7 pb-16">
      <h1 className="font-display text-headline font-semibold">Features</h1>
      <p className="mt-3 max-w-[60ch] text-[17px] text-muted">
        All the capabilities of yapholic
      </p>
      {groups.map((group) => (
        <Group key={group.title} title={group.title} features={group.features} isPro={isPro} />
      ))}
    </main>
  );
}
