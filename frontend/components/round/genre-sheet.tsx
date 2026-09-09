"use client";

import { CheckIcon, ChevronRightIcon, EditIcon, GenreIcon, PlusIcon } from "@/components/site/icons";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { Bank } from "@/lib/bank";
import { ownPath } from "@/lib/genres";
import { cn } from "@/lib/utils";

/* One flat list of the ten genres, no shelves, no search, no blurbs: ten
   names fit on one screen and name themselves. A genre is an option that
   picks; a row that leaves the round is a link, and it carries a chevron
   so the two are not one shape wearing two meanings.

   Yours leads the list on Pro and sits last otherwise, and it is never
   removed, signed out included: a stranger discovers making their own the
   same way, and /genres/yours is the honest place to ask them to sign in.

   Three doors, because there are three questions (docs/mocks/genre-picker.html,
   variant D). The heading edits the group, a pencil edits one genre, and
   the row at the foot only ever means "a new one". An action never sits
   in the identity column: the glyph on the left says which genre this is
   and nothing else, which is what went wrong when somebody saved a genre
   under the pencil icon and the row grew a second meaning. */
export function GenreSheet({
  open,
  onOpenChange,
  bank,
  current,
  isPro,
  ownCap,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bank: Bank;
  current: string;
  isPro: boolean;
  /** How many genres an account may hold, so the cap is said once here
      rather than refused later on the tenth. */
  ownCap?: number;
  onChoose: (slug: string) => void;
}) {
  const builtIn = bank.genres.filter((genre) => !genre.own);
  const own = bank.genres.filter((genre) => genre.own);
  const row =
    "flex w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[15px] font-semibold text-ink no-underline transition-colors hover:bg-card2";

  const yours = (
    <div className="my-2 border-y border-line py-2">
      <p className="flex items-center justify-between gap-3 px-3 pb-1">
        <span className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">
          Yours
          {own.length > 0 && ownCap ? (
            <span className="font-normal normal-case">
              {" "}
              &middot; {own.length} of {ownCap}
            </span>
          ) : null}
        </span>
        {own.length > 0 && (
          <a
            href="/genres/yours"
            className="inline-flex items-center gap-0.5 text-xs font-semibold text-muted no-underline hover:text-ink"
          >
            Edit
            <ChevronRightIcon size={13} />
          </a>
        )}
      </p>

      {own.map((genre) => (
        <div key={genre.slug} className="flex items-center">
          <Option genre={genre} selected={genre.slug === current} onChoose={onChoose} className={row} />
          {/* The pencil is a link and lives at the right edge beside the
              check, never in the identity column. Always drawn rather
              than shown on hover: on a touch screen there is no hover. */}
          <a
            href={ownPath(genre.slug)}
            aria-label={`Edit ${genre.name}`}
            className="inline-flex size-[34px] flex-none items-center justify-center rounded-[10px] text-muted no-underline transition-colors hover:bg-card2 hover:text-ink"
          >
            <EditIcon size={15} />
          </a>
        </div>
      ))}

      <a href="/genres/yours" className={row}>
        <PlusIcon className="text-accent" />
        <span className="flex-1">{own.length > 0 ? "Make a new genre" : "Make your own genre"}</span>
        <ChevronRightIcon size={15} className="text-muted" />
      </a>

      {/* Said once, and only here: with nothing of your own there is
          nothing to manage, so this is the only place the feature has to
          explain itself. */}
      {own.length === 0 && (
        <p className="px-3 pt-0.5 pb-1 text-[13px] text-muted">Paste or generate with AI.</p>
      )}
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
