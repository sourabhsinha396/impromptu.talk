"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Box, BoxFoot, Field, INPUT, Tool } from "@/components/administration/shell";
import { Button } from "@/components/site/button";
import type { Bank } from "@/lib/bank";
import { STAGE_KEY } from "@/lib/round/prefs";

/* Rigging the next spin, in this browser only.

   The staging never reaches the server: it is one key in localStorage,
   which is what makes it this browser rather than this account. Two
   people filming off one login do not stage over each other, and nothing
   about a rigged reel is written down beside somebody's real runs.

   The key is the genre and the words rather than a slug, because an owned
   genre's topics carry no slug of their own, and a slug would stage only
   half the picker. */
export function StagedTool({ bank }: { bank: Bank }) {
  const router = useRouter();
  const genres = bank.genres;
  const [genre, setGenre] = useState(genres[0]?.slug ?? "");
  const topics = useMemo(() => bank.topics.filter((topic) => topic.genre === genre), [bank.topics, genre]);
  const [text, setText] = useState("");
  const [staged, setStaged] = useState("");

  const chosen = text || topics[0]?.text || "";

  /* Staged, then straight to the tool: the operator is here because they
     are about to film a spin. The key is written before the navigation,
     so the round reads it on the way in. */
  function stage() {
    try {
      window.localStorage.setItem(STAGE_KEY, JSON.stringify({ g: genre, t: chosen }));
      setStaged(chosen);
      router.push("/");
    } catch {
      /* A browser with storage switched off cannot stage; the reel is
         honestly random, which is the state this tool exists to leave. */
      setStaged("");
    }
  }

  function clear() {
    try {
      window.localStorage.removeItem(STAGE_KEY);
    } catch {
      /* Nothing stored, nothing to clear. */
    }
    setStaged("");
  }

  return (
    <Tool
      name="Staged topic"
      lede="Fix what the next spin lands on, in this browser only. The reel still spins; only the winner is decided."
    >
      <Box>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Genre">
            <select
              value={genre}
              onChange={(event) => {
                setGenre(event.target.value);
                setText("");
              }}
              className={INPUT}
            >
              {genres.map((row) => (
                <option key={row.slug} value={row.slug}>
                  {row.name}
                  {row.own ? " (yours)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Topic">
            {/* The genre picks first, because the topic list is a
                thousand otherwise. */}
            <select value={chosen} onChange={(event) => setText(event.target.value)} className={INPUT}>
              {topics.map((topic) => (
                <option key={`${topic.genre}-${topic.text}`} value={topic.text}>
                  {topic.text}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <BoxFoot note="Written to this browser. Nothing is sent anywhere.">
          <Button size="sm" disabled={topics.length === 0} onClick={stage}>
            Stage and spin
          </Button>
        </BoxFoot>
      </Box>

      {staged && (
        <p
          role="status"
          className="mt-4 rounded-xl border border-line border-l-[3px] border-l-accent bg-card2 px-4 py-3 text-[14.5px] font-semibold"
        >
          Staged: &ldquo;{staged}&rdquo;. The next spin in this browser lands on it.
        </p>
      )}

      <p className="mt-6 text-[15px] text-muted">
        Staged already?{" "}
        <button type="button" onClick={clear} className="cursor-pointer font-semibold text-accent-strong underline">
          Clear it
        </button>
        , or go and{" "}
        <Link href="/" className="font-semibold text-accent-strong">
          spin
        </Link>
        .
      </p>
    </Tool>
  );
}
