"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/site/button";
import { DEFAULT_ICON, EditIcon, GenreIcon, ICONS, PlusIcon } from "@/components/site/icons";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { Mine } from "@/lib/owned";
import { cn } from "@/lib/utils";

/* The list of genres somebody wrote, as approved in docs/mocks/yours.html:
   the hub's own cards with a pencil, and "Make one" as the dashed card in
   the same grid, so the thing you make appears where you were already
   looking. The header says "3 of 10" because a cap said once beats a
   refusal after the typing.

   One component, two kinds, each with a URL of its own: topic genres live
   under `/genres/yours` and custom tongue twisters under
   `/pro/custom-tongue-twisters`, and neither list shows the other's rows. Two
   near-identical files would have been the alternative, and the parts that
   actually differ are a path, a noun and three sentences of copy
   (docs/DECISIONS.md). */
const COPY = {
  speak: {
    crumb: "All genres",
    crumbHref: "/genres",
    title: "Your genres",
    lede: "Topics you wrote, in the same picker as the bank. Paste a list, tag the styles, share the link.",
    base: "/genres/yours",
    practise: "/",
    practiseLabel: "Spin",
    noun: "topics",
    one: "topic",
    hint: "Name it, pick a glyph",
    locked: "Writing genres is part of Pro",
  },
  read: {
    crumb: "Tongue twisters",
    crumbHref: "/tongue-twisters",
    title: "Your tongue twisters",
    lede:
      "Passages you wrote, read on the same scroller. Paste them a paragraph at a time, with a blank line between.",
    base: "/pro/custom-tongue-twisters",
    practise: "/tongue-twisters",
    practiseLabel: "Read these on a scroller",
    noun: "passages",
    one: "passage",
    hint: "Name it, pick a glyph",
    locked: "Writing your own is part of Pro",
  },
} as const;

export function YourGenres({ mine, isPro, kind = "speak" }: { mine: Mine; isPro: boolean; kind?: "speak" | "read" }) {
  const [making, setMaking] = useState(false);
  const copy = COPY[kind];
  /* Each list shows only its own kind. The cap is on genres of every kind
     together, though, because that is what the backend counts: ten is ten
     whatever they hold. */
  const genres = mine.genres.filter((genre) => (genre.mode === "read") === (kind === "read"));
  const full = mine.genres.length >= mine.max_genres;

  return (
    <main className="mx-auto w-full max-w-[960px] flex-1 px-[clamp(16px,4vw,32px)] pt-7 pb-16">
      <p className="mb-3.5 text-[13px] font-semibold text-muted">
        <Link href={copy.crumbHref} className="text-inherit no-underline hover:text-ink">
          {copy.crumb}
        </Link>{" "}
        / Yours
      </p>
      <h1 className="font-display text-headline font-semibold">{copy.title}</h1>
      <p className="mt-3 max-w-[60ch] text-[17px] text-muted">{copy.lede}</p>

      {genres.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button href={copy.practise} size="lg">
            {copy.practiseLabel}
          </Button>
          <span className="text-[13px] font-semibold text-muted">
            {mine.genres.length} of {mine.max_genres}
          </span>
        </div>
      )}

      <div className="mt-7 grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3.5">
        {genres.map((genre) => (
          <Link
            key={genre.slug}
            href={`${copy.base}/${genre.slug}`}
            className="relative block rounded-card border border-line bg-card px-4.5 pt-4.5 pb-4 text-ink no-underline transition-colors hover:border-accent"
          >
            <EditIcon size={16} className="absolute top-3 right-3 text-muted" />
            <GenreIcon icon={genre.icon} size={22} className="text-accent" />
            <span className="mt-2.5 block text-base font-semibold">{genre.name}</span>
            <span className="mt-2 block text-xs font-semibold text-muted">
              {genre.topic_count} {genre.topic_count === 1 ? copy.one : copy.noun}
              {genre.share_token ? " · shared" : ""}
            </span>
          </Link>
        ))}
        {isPro && !full && (
          <button
            type="button"
            onClick={() => setMaking(true)}
            className="flex min-h-[118px] cursor-pointer flex-col items-start justify-center rounded-card border border-dashed border-line bg-card px-4.5 py-4 text-left text-muted transition-colors hover:border-accent"
          >
            <PlusIcon size={22} className="text-accent" />
            <span className="mt-2.5 block text-base font-semibold text-ink">Make one</span>
            <span className="mt-2 block text-xs font-semibold text-muted">{copy.hint}</span>
          </button>
        )}
      </div>

      {isPro && full && (
        <p className="mt-4 text-sm text-muted">
          That is {mine.max_genres} genres, the most an account holds. Delete one to make another.
        </p>
      )}

      {!isPro && (
        <section className="mt-6 rounded-card border border-line bg-card px-5.5 py-5">
          <h2 className="font-display text-lg font-semibold">{copy.locked}</h2>
          <p className="mt-1.5 max-w-[52ch] text-[15px] text-muted">
            Your genres stay here and still work. You can practise them, and any link you shared keeps opening. Pro is
            what adds new ones and edits these.
          </p>
          <div className="mt-3.5">
            <Button href="/pro">See Pro</Button>
          </div>
        </section>
      )}

      <MakeOne open={making} onOpenChange={setMaking} kind={kind} base={copy.base} />
    </main>
  );
}

function MakeOne({
  open,
  onOpenChange,
  kind,
  base,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /* Not a choice in the sheet: the page somebody is standing on already
     says which kind they are making, and the kind is the one thing that
     cannot be changed afterwards - the parser, the cap and the page it is
     practised on all follow from it. */
  kind: "speak" | "read";
  base: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(DEFAULT_ICON);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function make() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/topics/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, icon, mode: kind }),
      });
      const answer = (await response.json().catch(() => null)) as { slug?: string; detail?: string } | null;
      if (!response.ok || !answer?.slug) {
        setError(answer?.detail ?? "That did not go through. Try again.");
        return;
      }
      /* Straight into the editor: somebody who has just named a genre
         came here to put topics in it. */
      router.push(`${base}/${answer.slug}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={kind === "read" ? "Make a set" : "Make a genre"}
        description="You can paste what goes in it next."
      >
        <label htmlFor="genre-name" className="mb-1.5 block text-sm font-semibold">
          Name
        </label>
        <input
          id="genre-name"
          value={name}
          maxLength={60}
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
          className="w-full rounded-[10px] border border-line-strong bg-card2 px-3 py-2.5 text-[15px] text-ink"
        />
        <p className="mt-4 mb-1.5 text-sm font-semibold">Glyph</p>
        <div className="grid grid-cols-8 gap-1.5">
          {Object.keys(ICONS).map((slug) => (
            <button
              key={slug}
              type="button"
              aria-label={slug}
              aria-pressed={slug === icon}
              onClick={() => setIcon(slug)}
              className={cn(
                "grid aspect-square cursor-pointer place-items-center rounded-[10px] border",
                slug === icon ? "border-accent bg-card2 text-accent" : "border-line text-muted hover:text-ink",
              )}
            >
              <GenreIcon icon={slug} size={18} />
            </button>
          ))}
        </div>
        {error && <p className="mt-4 border-l-2 border-ink pl-3 text-sm text-ink">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={busy || name.trim() === ""} onClick={make}>
            Make it
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
