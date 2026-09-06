"use client";

import { lengthWords } from "@/components/round/phases";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { Bank } from "@/lib/bank";
import { ownStyles } from "@/lib/round/pool";
import { PREP_RANGE, SPEAK_RANGE, SURPRISE, type Prefs } from "@/lib/round/prefs";

/* The round's own settings: the two lengths, the style, the sound. A
   preference set once, so it lives here and not in the header. The
   sliders step in whole minutes; the number beside the label follows the
   thumb, and the pref is written on release, because dragging from a
   minute to ten is one decision, not nine. */
export function SettingsSheet({
  open,
  onOpenChange,
  bank,
  prefs,
  onPreview,
  onLength,
  onStyle,
  onSound,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bank: Bank;
  prefs: Prefs;
  onPreview: (which: "prep" | "speak", seconds: number) => void;
  onLength: (which: "prep" | "speak", seconds: number) => void;
  onStyle: (key: string) => void;
  onSound: (on: boolean) => void;
}) {
  const coined = ownStyles(bank, prefs.genre);
  const builtIn = bank.styles.find((style) => style.key === prefs.style);
  const hint = builtIn ? builtIn.hint : coined.includes(prefs.style) ? `${prefs.style} - your own style.` : "";
  const setup = `${prefs.prep ? `${lengthWords(prefs.prep)} to think` : "No prep"} · ${lengthWords(prefs.speak)} to talk`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Settings" description={setup}>
        <div className="flex flex-col gap-5">
          <Length
            id="prep"
            label="Thinking time"
            value={prefs.prep}
            range={PREP_RANGE}
            onPreview={(seconds) => onPreview("prep", seconds)}
            onCommit={(seconds) => onLength("prep", seconds)}
          />
          <Length
            id="speak"
            label="Talking time"
            value={prefs.speak}
            range={SPEAK_RANGE}
            onPreview={(seconds) => onPreview("speak", seconds)}
            onCommit={(seconds) => onLength("speak", seconds)}
          />

          <div>
            <label htmlFor="style" className="mb-1.5 block text-sm font-semibold">
              Style
            </label>
            <select
              id="style"
              value={prefs.style}
              onChange={(event) => onStyle(event.target.value)}
              className="w-full rounded-[10px] border border-line-strong bg-card2 px-3 py-2.5 text-[15px] font-semibold text-ink"
            >
              {bank.styles.map((style) => (
                <option key={style.key} value={style.key}>
                  {style.label}
                </option>
              ))}
              {coined.map((name) => (
                <option key={name} value={name}>
                  {name} (your own style)
                </option>
              ))}
            </select>
            {hint && <p className="mt-1.5 text-[13px] text-muted">{hint}</p>}
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
            <input
              type="checkbox"
              checked={!prefs.sound}
              onChange={(event) => onSound(!event.target.checked)}
              className="size-4 accent-accent"
            />
            Mute sound effects
          </label>

          {/* Only where there is a keyboard: a phone has no space bar. */}
          <p className="hidden text-[12.5px] text-muted [@media(hover:hover)]:block">
            <kbd className="rounded-md border border-line-strong px-1.5">space</kbd> starts and pauses{" "}
            <kbd className="ml-1 rounded-md border border-line-strong px-1.5">N</kbd> for a new topic{" "}
            <kbd className="ml-1 rounded-md border border-line-strong px-1.5">esc</kbd> resets
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Length({
  id,
  label,
  value,
  range,
  onPreview,
  onCommit,
}: {
  id: string;
  label: string;
  value: number;
  range: [number, number];
  onPreview: (seconds: number) => void;
  onCommit: (seconds: number) => void;
}) {
  const commit = (event: { currentTarget: HTMLInputElement }) => onCommit(Number(event.currentTarget.value));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm font-semibold">
        <label htmlFor={id}>{label}</label>
        <span className="text-muted">{lengthWords(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={range[0]}
        max={range[1]}
        step={60}
        value={value}
        onChange={(event) => onPreview(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="w-full accent-accent"
      />
    </div>
  );
}

export { SURPRISE };
