"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Hint, Refused, Saved, SectionBody, SectionFoot } from "@/components/account/section";
import { Button } from "@/components/site/button";
import { sendJson } from "@/lib/forms";
import { ACCENTS, type Accent, validAccent } from "@/lib/palette";

/** The six colours, as swatches you can see.

    v0 shipped a dropdown of colour names and one dot beside it, so
    choosing meant reading the word "Magenta" and imagining it. Picking
    one here paints the whole page at once, which is a better argument for
    Pro than a locked row could ever be: the accent is on the topic, the
    streak and every link, and that is the thing being sold. */
export function AccentPicker({ accent }: { accent: string }) {
  const router = useRouter();
  const stored = validAccent(accent);
  const [picked, setPicked] = useState<Accent>(stored);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const settled = useRef(stored);

  /* The preview writes straight to the attribute the whole stylesheet
     reads, so it costs no state and no reload. It is also why this has to
     be put back on the way out: a client navigation keeps the same <html>
     element, and an unsaved colour would otherwise follow somebody around
     the site as if they had bought it. */
  useEffect(() => {
    document.documentElement.dataset.accent = picked;
    return () => {
      document.documentElement.dataset.accent = settled.current;
    };
  }, [picked]);

  async function save() {
    setBusy(true);
    const refusal = await sendJson("PATCH", "/api/v1/auth/accent", { accent: picked });
    setBusy(false);
    setError(refusal ?? "");
    if (refusal) return;
    settled.current = picked;
    setJustSaved(true);
    router.refresh();
  }

  return (
    <>
      <SectionBody>
        <div className="flex flex-wrap gap-2.5">
          {Object.entries(ACCENTS).map(([slug, label]) => (
            <button
              key={slug}
              type="button"
              aria-pressed={picked === slug}
              onClick={() => {
                setPicked(slug as Accent);
                setJustSaved(false);
                setError("");
              }}
              className={`flex w-[78px] cursor-pointer flex-col items-center gap-[7px] rounded-xl border px-2 pt-2.5 pb-2 ${
                picked === slug ? "border-ink bg-card2" : "border-line hover:border-line-strong"
              }`}
            >
              {/* The swatch is the colour itself at the lightness this
                  theme uses, which is the only honest preview: what
                  somebody picks is a hue, never a lightness. Written out
                  rather than `bg-accent`, because a custom property is
                  substituted where it is declared: `--accent` computes on
                  <html> and inherits as a finished colour, so a utility
                  would paint all six the current accent. The parts are
                  the tokens, so no colour is spelled out here. */}
              <span
                aria-hidden
                data-accent={slug}
                style={{ background: "oklch(var(--accent-l) var(--accent-c) var(--accent-h))" }}
                className="block size-[30px] rounded-full"
              />
              <span className={`text-xs font-semibold ${picked === slug ? "text-ink" : "text-muted"}`}>{label}</span>
            </button>
          ))}
        </div>
      </SectionBody>
      <SectionFoot>
        <Button size="sm" onClick={save} disabled={busy || picked === settled.current}>
          Save colour
        </Button>
        {error ? <Refused>{error}</Refused> : justSaved ? <Saved /> : null}
        <Hint>Picking one shows it straight away. Save keeps it.</Hint>
      </SectionFoot>
    </>
  );
}
