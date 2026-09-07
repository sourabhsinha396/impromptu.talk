"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CopyField } from "@/components/account/copy-field";
import { Button } from "@/components/site/button";
import { CloseIcon, EditIcon, GenreIcon } from "@/components/site/icons";
import type { Style } from "@/lib/bank";
import type { OwnedGenre, OwnedTopic } from "@/lib/owned";
import { absolute } from "@/lib/site";
import { cn } from "@/lib/utils";

const FAILED = "That did not go through. Try again.";

/* The editor, as approved in docs/mocks/yours.html. One card for adding
   with a segment over it (paste a list, or describe them, which is card
   30), then the topics, then sharing, then delete. Every write answers
   with the whole genre, so the page never assembles its own idea of what
   landed: a paste that skipped four repeats shows four fewer rows because
   the backend said so. */
export function Editor({
  genre: initial,
  styles,
  isPro,
  canGenerate,
  generationsLeft,
  maxTopics,
}: {
  genre: OwnedGenre;
  styles: Style[];
  isPro: boolean;
  /** Whether the model key is set. With none there is no second way in. */
  canGenerate: boolean;
  generationsLeft: number;
  maxTopics: number;
}) {
  const [genre, setGenre] = useState(initial);
  const [left, setLeft] = useState(generationsLeft);
  const [error, setError] = useState("");
  const base = `/api/v1/topics/mine/${encodeURIComponent(genre.slug)}`;

  async function write(method: string, path: string, body?: Record<string, unknown>) {
    setError("");
    try {
      const response = await fetch(path, {
        method,
        ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
      });
      const answer = (await response.json().catch(() => null)) as (OwnedGenre & { detail?: string }) | null;
      if (!response.ok) {
        setError(answer?.detail ?? FAILED);
        return false;
      }
      if (answer) setGenre(answer);
      return true;
    } catch {
      setError(FAILED);
      return false;
    }
  }

  /* Sharing answers with the token rather than the genre, since turning
     it off leaves nothing to hand back: the token is cleared, not parked,
     so the link somebody was already sent is dead. */
  async function flipShare(on: boolean) {
    setError("");
    try {
      const response = await fetch(`${base}/share`, { method: on ? "POST" : "DELETE" });
      const answer = (await response.json().catch(() => null)) as { token?: string | null; detail?: string } | null;
      if (!response.ok) {
        setError(answer?.detail ?? FAILED);
        return;
      }
      setGenre({ ...genre, share_token: answer?.token ?? null });
    } catch {
      setError(FAILED);
    }
  }

  /* The allowance is spent whether or not the model answers, so the count
     comes back with the failure too and the page shows it going down. An
     account that could retry a failure for free would have no ceiling. */
  async function generate(prompt: string) {
    setError("");
    try {
      const response = await fetch(`${base}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const answer = (await response.json().catch(() => null)) as {
        genre?: OwnedGenre;
        added?: number;
        generations_left?: number;
        detail?: string;
      } | null;
      if (!response.ok) {
        setError(answer?.detail ?? FAILED);
        setLeft((spent) => Math.max(0, spent - 1));
        return false;
      }
      if (answer?.genre) setGenre(answer.genre);
      setLeft(answer?.generations_left ?? left);
      return true;
    } catch {
      setError(FAILED);
      return false;
    }
  }

  return (
    <main className="mx-auto w-full max-w-[960px] flex-1 px-[clamp(16px,4vw,32px)] pt-7 pb-16">
      <p className="mb-3.5 text-[13px] font-semibold text-muted">
        <Link href="/genres" className="text-inherit no-underline hover:text-ink">
          All genres
        </Link>{" "}
        /{" "}
        <Link href="/genres/yours" className="text-inherit no-underline hover:text-ink">
          Yours
        </Link>{" "}
        / {genre.name}
      </p>
      <h1 className="flex items-center gap-3 font-display text-headline font-semibold">
        <GenreIcon icon={genre.icon} size={30} className="flex-none text-accent" />
        {genre.name}
      </h1>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button href={`/?genre=yours:${genre.slug}`} size="lg">
          Practise this genre
        </Button>
        <span className="text-[13px] font-semibold text-muted">
          {genre.topic_count} of {maxTopics} topics
        </span>
      </div>

      {error && <p className="mt-4 border-l-2 border-ink pl-3 text-sm text-ink">{error}</p>}

      {isPro && (
        <AddTopics
          styles={styles}
          canGenerate={canGenerate}
          left={left}
          onPaste={(text, defaultStyle) => write("POST", `${base}/topics`, { text, default_style: defaultStyle })}
          onGenerate={generate}
        />
      )}

      <ul className="mt-4.5 list-none p-0">
        {genre.topics.map((topic) => (
          <Row
            key={topic.id}
            topic={topic}
            styles={styles}
            ownStyles={genre.own_styles}
            editable={isPro}
            onSave={(text, style) => write("PATCH", `${base}/topics/${topic.id}`, { text, style })}
            onDelete={() => write("DELETE", `${base}/topics/${topic.id}`)}
          />
        ))}
      </ul>

      {genre.topics.length === 0 && (
        <p className="mt-6 text-[15px] text-muted">Nothing in here yet. Paste a few lines above.</p>
      )}

      <Sharing token={genre.share_token} editable={isPro} onFlip={flipShare} />

      <DeleteGenre slug={genre.slug} />
    </main>
  );
}

function AddTopics({
  styles,
  canGenerate,
  left,
  onPaste,
  onGenerate,
}: {
  styles: Style[];
  canGenerate: boolean;
  left: number;
  onPaste: (text: string, defaultStyle: string) => Promise<boolean>;
  onGenerate: (prompt: string) => Promise<boolean>;
}) {
  /* Paste is the default way in because it always works: describing needs
     the model key and an allowance, and a default that is sometimes
     missing is not a default. */
  const [way, setWay] = useState<"paste" | "describe">("paste");
  const [text, setText] = useState("");
  const [prompt, setPrompt] = useState("");
  const [defaultStyle, setDefaultStyle] = useState("just-talk");
  const [busy, setBusy] = useState(false);
  const real = styles.filter((style) => style.key !== "surprise");
  /* What the button says it will do, counted the way the backend counts
     it: a blank line is not a topic. Seeing the number before pressing is
     the cheapest check there is against a bad paste. */
  const lines = text.split("\n").filter((line) => line.trim() !== "").length;

  async function add() {
    setBusy(true);
    try {
      if (await onPaste(text, defaultStyle)) setText("");
    } finally {
      setBusy(false);
    }
  }

  async function describe() {
    setBusy(true);
    try {
      if (await onGenerate(prompt)) setPrompt("");
    } finally {
      setBusy(false);
    }
  }

  const tab = "cursor-pointer rounded-full px-3.5 py-1.5 text-[13px] font-semibold";

  return (
    <section className="mt-4.5 rounded-card border border-line bg-card p-4.5">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Add topics</h2>
        {canGenerate && (
          <div className="inline-flex gap-0.5 rounded-full border border-line bg-card2 p-0.5">
            <button type="button" onClick={() => setWay("paste")} className={cn(tab, way === "paste" ? "bg-card text-ink" : "text-muted")}>
              Paste a list
            </button>
            <button type="button" onClick={() => setWay("describe")} className={cn(tab, way === "describe" ? "bg-card text-ink" : "text-muted")}>
              Describe them
            </button>
          </div>
        )}
      </div>

      {way === "paste" ? (
        <>
          <p className="mb-3 text-[13.5px] text-muted">
            One line, one topic. End a line with a style to tag it: <b className="font-semibold">Tipping should end,
            hot take</b>.
          </p>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={"Tell me about yourself\nWhy do you want this job\nDescribe a time you failed, tell a story"}
            className="min-h-[120px] w-full resize-y rounded-[10px] border border-line-strong bg-card2 px-3.5 py-3 text-[15px]/[1.5] text-ink"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[13.5px] font-semibold text-muted">
              <label htmlFor="default-style">Lines with no style</label>
              <select
                id="default-style"
                value={defaultStyle}
                onChange={(event) => setDefaultStyle(event.target.value)}
                className="rounded-[10px] border border-line-strong bg-card2 px-3 py-2.5 text-sm font-semibold text-ink"
              >
                {real.map((style) => (
                  <option key={style.key} value={style.key}>
                    {style.label}
                  </option>
                ))}
              </select>
            </div>
            <Button size="sm" disabled={busy || lines === 0} onClick={add}>
              {lines > 0 ? `Add ${lines} topic${lines === 1 ? "" : "s"}` : "Add topics"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-3 text-[13.5px] text-muted">
            Say what you want to practise and twenty topics come back, yours to edit or delete.
          </p>
          <input
            value={prompt}
            maxLength={300}
            placeholder="Behavioural questions for a first engineering job"
            onChange={(event) => setPrompt(event.target.value)}
            className="w-full rounded-[10px] border border-line-strong bg-card2 px-3.5 py-2.5 text-[15px] text-ink"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            {/* The count sits beside the button that spends it, on the page
                before the press rather than as a refusal after it. */}
            <span className="text-[13.5px] font-semibold text-muted">
              {left === 0 ? "None left this month" : `${left} generation${left === 1 ? "" : "s"} left this month`}
            </span>
            <Button size="sm" disabled={busy || left === 0 || prompt.trim() === ""} onClick={describe}>
              {busy ? "Writing them" : "Generate 20 topics"}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}

function Row({
  topic,
  styles,
  ownStyles,
  editable,
  onSave,
  onDelete,
}: {
  topic: OwnedTopic;
  styles: Style[];
  ownStyles: string[];
  editable: boolean;
  onSave: (text: string, style: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(topic.text);
  const [style, setStyle] = useState(topic.style);
  const [naming, setNaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const real = styles.filter((entry) => entry.key !== "surprise");

  async function save() {
    setBusy(true);
    try {
      if (await onSave(text, style)) setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <li className="flex flex-wrap items-center gap-2.5 border-b border-line px-1 py-2.5">
        <input
          value={text}
          maxLength={200}
          onChange={(event) => setText(event.target.value)}
          className="min-w-[160px] flex-1 rounded-[10px] border border-line-strong bg-card2 px-3 py-2.5 text-[15px] text-ink"
        />
        {naming ? (
          <input
            value={style}
            maxLength={24}
            autoFocus
            placeholder="Name a style"
            onChange={(event) => setStyle(event.target.value)}
            className="w-[170px] rounded-[10px] border border-line-strong bg-card2 px-3 py-2.5 text-sm font-semibold text-ink"
          />
        ) : (
          <select
            value={style}
            onChange={(event) => {
              if (event.target.value === "__name__") {
                setNaming(true);
                setStyle("");
              } else setStyle(event.target.value);
            }}
            className="rounded-[10px] border border-line-strong bg-card2 px-3 py-2.5 text-sm font-semibold text-ink"
          >
            {real.map((entry) => (
              <option key={entry.key} value={entry.key}>
                {entry.label}
              </option>
            ))}
            {ownStyles.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
            <option value="__name__">Name a style</option>
          </select>
        )}
        <Button size="sm" disabled={busy || text.trim() === ""} onClick={save}>
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setEditing(false);
            setNaming(false);
            setText(topic.text);
            setStyle(topic.style);
          }}
        >
          Cancel
        </Button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 border-b border-line px-1 py-2.5">
      <span className="min-w-0 flex-1 text-[15.5px]">{topic.text}</span>
      <span className="rounded-full border border-line bg-card2 px-2.5 py-0.5 text-[11.5px] font-semibold text-muted">
        {topic.style_label}
      </span>
      {editable && (
        <span className="flex gap-0.5">
          <IconButton label={`Edit ${topic.text}`} onClick={() => setEditing(true)}>
            <EditIcon size={16} />
          </IconButton>
          <IconButton label={`Delete ${topic.text}`} onClick={() => void onDelete()}>
            <CloseIcon size={16} />
          </IconButton>
        </span>
      )}
    </li>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-card2 hover:text-ink"
    >
      {children}
    </button>
  );
}

function Sharing({
  token,
  editable,
  onFlip,
}: {
  token: string | null;
  editable: boolean;
  onFlip: (on: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const on = token !== null;

  async function flip() {
    setBusy(true);
    try {
      await onFlip(!on);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6.5 rounded-card border border-line bg-card p-4.5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Share this genre</h2>
          <p className="mt-1 text-[13.5px] text-muted">
            Anyone with the link can read it and practise it. No account needed.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Sharing"
          disabled={busy || !editable}
          onClick={flip}
          className={cn(
            "relative h-7 w-12 flex-none cursor-pointer rounded-full border transition-colors disabled:cursor-not-allowed",
            on ? "border-accent bg-accent" : "border-line-strong bg-card2",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "absolute top-[3px] left-[3px] size-5 rounded-full transition-transform",
              on ? "translate-x-5 bg-surface" : "bg-line-strong",
            )}
          />
        </button>
      </div>
      {on && token && (
        <div className="mt-3.5">
          <CopyField url={absolute(`/g/${token}`)} label="Link to this genre" />
        </div>
      )}
      <p className="mt-2.5 text-[13.5px] text-muted">Turning this off kills the link people already have.</p>
    </section>
  );
}

function DeleteGenre({ slug }: { slug: string }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await fetch(`/api/v1/topics/mine/${encodeURIComponent(slug)}`, { method: "DELETE" });
      router.push("/genres/yours");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8.5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4.5">
      <p className="text-[13.5px] text-muted">
        {asking
          ? "This takes its topics with it. Your finished rounds stay."
          : "Deleting a genre takes its topics with it. Your finished rounds stay."}
      </p>
      {asking ? (
        <span className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setAsking(false)}>
            Keep it
          </Button>
          <Button size="sm" disabled={busy} onClick={remove}>
            Delete it
          </Button>
        </span>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setAsking(true)}>
          Delete this genre
        </Button>
      )}
    </div>
  );
}
