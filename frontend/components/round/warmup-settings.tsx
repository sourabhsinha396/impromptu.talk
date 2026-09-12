"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { LEVELS } from "@/lib/bank";
import { SURPRISE } from "@/lib/round/prefs";

/* A warm-up's own settings, and the reason feature pages have their own.

   On home's sheet a warm-up left five of six controls doing nothing:
   thinking time and talking time have no phases here, style has no
   meaning on words you read verbatim, pictures are never drawn, and
   nothing listens. A control that silently does nothing is the failure
   `SPEC.md` already names for styles, and hiding five of them on home
   would have been the start of one sheet answering for every feature.

   So this is the whole of it: which passages you get handed, and whether
   it makes a sound. The speed is not here on purpose - it is picked on the
   passage screen, where "Again, at 180" is the loop, and a value with two
   homes is a value that disagrees with itself. */
export function WarmUpSettings({
  open,
  onOpenChange,
  sources,
  source,
  difficulty,
  sound,
  onSource,
  onDifficulty,
  onSound,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The banks this page can draw from: its own, then the visitor's. One
      entry means there is nothing to choose and the row is not drawn. */
  sources: { slug: string; name: string; own?: boolean }[];
  source: string;
  difficulty: string;
  sound: boolean;
  onSource: (slug: string) => void;
  onDifficulty: (key: string) => void;
  onSound: (on: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Settings" description="What you get handed, and how loud.">
        <div className="flex flex-col gap-5">
          {/* Which bank, when there is more than one. This is the same
              axis home's genre picker is: it narrows what a spin can land
              on, and it does not change what the round is, so it belongs
              in settings rather than taking a URL of its own. */}
          {sources.length > 1 && (
            <div>
              <label htmlFor="passages" className="mb-1.5 block text-sm font-semibold">
                Passages
              </label>
              <select
                id="passages"
                value={source}
                onChange={(event) => onSource(event.target.value)}
                className="w-full rounded-[10px] border border-line-strong bg-card2 px-3 py-2.5 text-[15px] font-semibold text-ink"
              >
                {sources.map((one) => (
                  <option key={one.slug} value={one.own ? one.slug : ""}>
                    {one.name}
                    {one.own ? " (yours)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="difficulty" className="mb-1.5 block text-sm font-semibold">
              Difficulty
            </label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(event) => onDifficulty(event.target.value)}
              className="w-full rounded-[10px] border border-line-strong bg-card2 px-3 py-2.5 text-[15px] font-semibold text-ink"
            >
              {/* The same slot style occupies on home, speaking this mode's
                  vocabulary: it narrows what a spin can land on, and
                  Surprise me means no filter here exactly as it does
                  there. Both levels are free, always. */}
              <option value={SURPRISE}>Surprise me</option>
              {LEVELS.map((level) => (
                <option key={level.key} value={level.key}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
              <input
                type="checkbox"
                checked={sound}
                onChange={(event) => onSound(event.target.checked)}
                className="size-4 accent-accent"
              />
              Sound
            </label>
            <p className="mt-1.5 text-[13px] text-muted">A chime when the words start, and one when they run out.</p>
          </div>

          <p className="hidden text-[12.5px] text-muted [@media(hover:hover)]:block">
            <kbd className="rounded-md border border-line-strong px-1.5">space</kbd> starts{" "}
            <kbd className="ml-1 rounded-md border border-line-strong px-1.5">N</kbd> for another passage{" "}
            <kbd className="ml-1 rounded-md border border-line-strong px-1.5">esc</kbd> stops
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
