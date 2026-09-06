"use client";

import { CheckIcon, GenreIcon, PlusIcon } from "@/components/site/icons";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { Bank } from "@/lib/bank";
import { cn } from "@/lib/utils";

/* One flat list of the ten genres, no shelves, no search, no blurbs: ten
   names fit on one screen and name themselves. A genre is an option that
   picks; the row to the editor is a link that leaves, and the two wear
   one shape on purpose.

   Yours leads the list on Pro and sits last otherwise, and it is never
   removed, signed out included: a stranger discovers making their own
   the same way, and /packs is the honest place to ask them to sign in. */
export function GenreSheet({
  open,
  onOpenChange,
  bank,
  current,
  isPro,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bank: Bank;
  current: string;
  isPro: boolean;
  onChoose: (slug: string) => void;
}) {
  const builtIn = bank.genres.filter((genre) => !genre.own);
  const own = bank.genres.filter((genre) => genre.own);
  const row =
    "flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[15px] font-semibold text-ink no-underline transition-colors hover:bg-card2";

  const yours = (
    <div className="my-2 border-y border-line py-2">
      <p className="px-3 pb-1 text-xs font-semibold tracking-[0.08em] text-muted uppercase">Yours</p>
      {own.map((genre) => (
        <Option key={genre.slug} genre={genre} selected={genre.slug === current} onChoose={onChoose} className={row} />
      ))}
      <a href="/packs" className={row}>
        <PlusIcon className="text-accent" />
        Make your own genre
      </a>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Genre" description="What you want to talk about.">
        {isPro && yours}
        <div role="listbox" aria-label="Genres" className="flex flex-col">
          {builtIn.map((genre) => (
            <Option key={genre.slug} genre={genre} selected={genre.slug === current} onChoose={onChoose} className={row} />
          ))}
        </div>
        {!isPro && yours}
      </SheetContent>
    </Sheet>
  );
}

function Option({
  genre,
  selected,
  onChoose,
  className,
}: {
  genre: { slug: string; name: string; icon: string };
  selected: boolean;
  onChoose: (slug: string) => void;
  className: string;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => onChoose(genre.slug)}
      className={cn(className, selected && "bg-card2")}
    >
      <GenreIcon icon={genre.icon} className="text-accent" />
      <span className="flex-1">{genre.name}</span>
      {selected && <CheckIcon className="text-accent-strong" />}
    </button>
  );
}
