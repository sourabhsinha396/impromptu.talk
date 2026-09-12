"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { CopyField } from "@/components/account/copy-field";
import { Button } from "@/components/site/button";
import { CloseIcon, EditIcon, GenreIcon } from "@/components/site/icons";
import { LEVELS, type Style } from "@/lib/bank";
import { PICTURE_TOO_BIG, type OwnedGenre, type OwnedTopic } from "@/lib/owned";
import { compress } from "@/lib/pictures";
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
  /* Multipart, so it cannot go through `write`: that one sets a JSON
     content type, and a multipart body needs the browser to set its own
     header with the boundary in it. */
  async function upload(file: File, text: string, style: string) {
    setError("");
    const body = new FormData();
    body.append("picture", file);
    body.append("text", text);
    body.append("style", style);
    try {
      const response = await fetch(`${base}/pictures`, { method: "POST", body });
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
        <Link
          href={genre.mode === "read" ? "/tongue-twisters" : "/genres"}
          className="text-inherit no-underline hover:text-ink"
        >
          {genre.mode === "read" ? "Tongue twisters" : "All genres"}
        </Link>{" "}
        /{" "}
        <Link
          href={genre.mode === "read" ? "/pro/custom-tongue-twisters" : "/genres/yours"}
          className="text-inherit no-underline hover:text-ink"
        >
          Yours
        </Link>{" "}
        / {genre.name}
      </p>
      <h1 className="flex items-center gap-3 font-display text-headline font-semibold">
        <GenreIcon icon={genre.icon} size={30} className="flex-none text-accent" />
        {genre.name}
      </h1>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* A warm-up is practised on the warm-up's page, where it appears
            in the Passages setting: home does not run a read genre, so
            sending somebody there would open a spoken round on a bank it
            cannot draw from. */}
        <Button href={genre.mode === "read" ? "/tongue-twisters" : `/?genre=yours:${genre.slug}`} size="lg">
          {genre.mode === "read" ? "Read these on a scroller" : "Practise this genre"}
        </Button>
        <span className="text-[13px] font-semibold text-muted">
          {genre.topic_count} of {genre.max_topics || maxTopics} {genre.mode === "read" ? "passages" : "topics"}
        </span>
      </div>

      {error && <p className="mt-4 border-l-2 border-ink pl-3 text-sm text-ink">{error}</p>}

      {isPro && (
        <AddTopics
          styles={styles}
          canGenerate={canGenerate}
          read={genre.mode === "read"}
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
            read={genre.mode === "read"}
            /* The key follows the kind: a prompt edits its `style` and a
               passage its `level`, which is the split the tables took.
               Sent under one key, the other kind's vocabulary arrived
               where nothing could read it. */
            onSave={(text, value) =>
              write(
                "PATCH",
                `${base}/topics/${topic.id}`,
                genre.mode === "read" ? { text, level: value } : { text, style: value },
              )
            }
            onDelete={() => write("DELETE", `${base}/topics/${topic.id}`)}
          />
        ))}
      </ul>

      {genre.topics.length === 0 && (
        <p className="mt-6 text-[15px] text-muted">
          {genre.mode === "read"
            ? "Nothing in here yet. Paste a passage above."
            : "Nothing in here yet. Paste a few lines above."}
        </p>
      )}

      {/* A passage has nothing to put a picture over: the words are the
          whole of what is on screen while it scrolls. */}
      {genre.mode !== "read" && (
        <AddPicture editable={isPro} shared={genre.share_token !== null} onUpload={upload} styles={styles} />
      )}

      <Sharing
        token={genre.share_token}
        editable={isPro}
        hasPictures={genre.has_pictures === true}
        onFlip={flipShare}
      />

      <DeleteGenre slug={genre.slug} />
    </main>
  );
}

function AddTopics({
  styles,
  canGenerate,
  read = false,
  left,
  onPaste,
  onGenerate,
}: {
  styles: Style[];
  canGenerate: boolean;
  /** A warm-up: passages read aloud rather than prompts talked about. */
  read?: boolean;
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
  /* Counted the way the backend counts it, which differs by kind: a
     prompt is a line and a passage is a paragraph, so a warm-up splits on
     blank lines. Counting per line there would promise fifty and add two.
     Seeing the number before pressing is the cheapest check there is
     against a bad paste. */
  const lines = read
    ? text.split(/\n\s*\n/).filter((block) => block.trim() !== "").length
    : text.split("\n").filter((line) => line.trim() !== "").length;
  const noun = read ? "passage" : "topic";

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
        <h2 className="text-base font-semibold">{read ? "Add passages" : "Add topics"}</h2>
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
            {read ? (
              <>
                One paragraph, one passage, with a blank line between them. Each has to be long enough to be worth
                scrolling: about forty words and up.
              </>
            ) : (
              <>
                One line, one topic. End a line with a style to tag it:{" "}
                <b className="font-semibold">Tipping should end, hot take</b>.
              </>
            )}
          </p>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              read
                ? "Six strict speech specialists structured sixty sophisticated speaking scripts...\n\nWhich witch watched which watch..."
                : "Tell me about yourself\nWhy do you want this job\nDescribe a time you failed, tell a story"
            }
            className="min-h-[120px] w-full resize-y rounded-[10px] border border-line-strong bg-card2 px-3.5 py-3 text-[15px]/[1.5] text-ink"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            {/* A passage has no style to default, only a difficulty, and
                that is picked per row rather than for a whole paste. */}
            <div className={cn("flex items-center gap-2 text-[13.5px] font-semibold text-muted", read && "hidden")}>
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
              {lines > 0 ? `Add ${lines} ${noun}${lines === 1 ? "" : "s"}` : `Add ${noun}s`}
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

/* Uploading one picture, with the sentence that goes over it. Deliberately
   one at a time rather than a multi-select: each picture needs its own
   prompt, and a bulk upload would leave somebody typing twenty of them
   into a list afterwards.

   Off entirely while a genre is shared, because the backend refuses it
   and the reason is worth reading before the file dialog opens rather
   than after. */
function AddPicture({
  editable,
  shared,
  styles,
  onUpload,
}: {
  editable: boolean;
  shared: boolean;
  styles: Style[];
  onUpload: (file: File, text: string, style: string) => Promise<boolean>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [text, setText] = useState("");
  const [style, setStyle] = useState("just-talk");
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState("");
  const real = styles.filter((s) => s.key !== "surprise");

  /* Shrunk here rather than only checked here: a camera roll picture is
     several megabytes and the ceiling is one, so a check on its own would
     refuse most of what anybody actually has. What the picker holds after
     this is what goes up, which is also what the KB beside it counts. */
  async function pick(chosen: File | null) {
    setRefused("");
    setFile(null);
    if (!chosen) return;
    setBusy(true);
    try {
      const ready = await compress(chosen);
      if (!ready) return setRefused(PICTURE_TOO_BIG);
      setFile(ready);
    } finally {
      setBusy(false);
    }
  }

  /* Revoked when it is replaced or the component goes, or every pick
     leaks the last one for the life of the page. */
  useEffect(() => {
    if (!file) return setPreview("");
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function send() {
    if (!file || text.trim() === "") return;
    setBusy(true);
    try {
      if (await onUpload(file, text.trim(), style)) {
        setFile(null);
        setRefused("");
        setText("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6.5 rounded-card border border-line bg-card p-4.5">
      <h2 className="text-base font-semibold">Add a picture</h2>
      <p className="mt-1 text-[13.5px] text-muted">
        {shared
          ? "Stop sharing this genre first. A genre with your own pictures in it stays private."
          : "A photograph to talk about, and the line that goes over it. Same round, with a picture."}
      </p>

      {!shared && (
        <div className="mt-3.5 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <label
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 rounded-full border border-line-strong px-4 py-2 text-sm font-semibold text-muted",
                (!editable || busy) && "cursor-not-allowed opacity-50",
              )}
            >
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={!editable || busy}
                onChange={(event) => pick(event.target.files?.[0] ?? null)}
              />
              {file ? "Choose another" : "Choose a picture"}
            </label>
            {file && <span className="text-[13px] text-muted">{Math.round(file.size / 1024)}KB</span>}
            {refused && <span className="text-[13px] text-ink">{refused}</span>}
          </div>

          {preview && (
            <div className="aspect-[4/3] w-full max-w-[260px] overflow-hidden rounded-xl bg-card2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="" className="h-full w-full object-cover" />
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex-1 basis-[16rem]">
              <span className="mb-1.5 block text-sm font-semibold">What to talk about</span>
              <input
                value={text}
                maxLength={200}
                placeholder="The road I didn't take"
                disabled={!editable || busy}
                onChange={(event) => setText(event.target.value)}
                className="w-full rounded-[10px] border border-line-strong bg-card2 px-3 py-2.5 text-[15px] font-semibold text-ink"
              />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-semibold">Style</span>
              <select
                value={style}
                disabled={!editable || busy}
                onChange={(event) => setStyle(event.target.value)}
                className="rounded-[10px] border border-line-strong bg-card2 px-3 py-2.5 text-[15px] font-semibold text-ink"
              >
                {real.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <Button size="sm" disabled={!editable || busy || !file || text.trim() === ""} onClick={send}>
              {busy ? "Uploading" : "Add picture"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function Row({
  topic,
  styles,
  ownStyles,
  editable,
  read = false,
  onSave,
  onDelete,
}: {
  topic: OwnedTopic;
  styles: Style[];
  ownStyles: string[];
  editable: boolean;
  /** A passage rather than a prompt: longer, and carrying a level from a
      fixed pair where a prompt carries a style it may have coined. */
  read?: boolean;
  onSave: (text: string, value: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(topic.text);
  const [style, setStyle] = useState(read ? (topic.level ?? "hard") : (topic.style ?? ""));
  const [naming, setNaming] = useState(false);
  const [busy, setBusy] = useState(false);
  const real = styles.filter((entry) => entry.key !== "surprise");
  /* The one place this row would have cut somebody's work in half. The
     input was capped at a prompt's 200 characters and a passage runs to
     1200, so editing one truncated it in the field, with nothing said
     and the shortened version saved on the next press. */
  const limit = read ? 1200 : 200;

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
        {read ? (
          /* A textarea, because a passage is a paragraph: a hundred words
             in a one-line input is a hundred words nobody can read while
             they are changing them. */
          <textarea
            value={text}
            maxLength={limit}
            rows={5}
            onChange={(event) => setText(event.target.value)}
            className="min-w-[160px] flex-1 rounded-[10px] border border-line-strong bg-card2 px-3 py-2.5 text-[15px] leading-[1.6] text-ink"
          />
        ) : (
          <input
            value={text}
            maxLength={limit}
            onChange={(event) => setText(event.target.value)}
            className="min-w-[160px] flex-1 rounded-[10px] border border-line-strong bg-card2 px-3 py-2.5 text-[15px] text-ink"
          />
        )}
        {read ? (
          <select
            value={style}
            onChange={(event) => setStyle(event.target.value)}
            className="rounded-[10px] border border-line-strong bg-card2 px-3 py-2.5 text-sm font-semibold text-ink"
          >
            {/* Two values and no way to coin a third: nobody chooses how to
                say words they are reading verbatim, so a passage has one
                axis and it is this one. */}
            {LEVELS.map((level) => (
              <option key={level.key} value={level.key}>
                {level.label}
              </option>
            ))}
          </select>
        ) : naming ? (
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
            setStyle(read ? (topic.level ?? "hard") : (topic.style ?? ""));
          }}
        >
          Cancel
        </Button>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 border-b border-line px-1 py-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {topic.image && (
        <img
          src={topic.image}
          alt=""
          className="size-11 flex-none rounded-lg bg-card2 object-cover"
          loading="lazy"
        />
      )}
      <span className="min-w-0 flex-1 text-[15.5px]">{topic.text}</span>
      <span className="rounded-full border border-line bg-card2 px-2.5 py-0.5 text-[11.5px] font-semibold whitespace-nowrap text-muted capitalize">
        {/* A passage says its level and how long it is, because the speed
            the scroller runs at is in words a minute. A prompt says how it
            is asked. */}
        {read ? `${topic.level} · ${topic.words} words` : topic.style_label}
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
  hasPictures,
  onFlip,
}: {
  token: string | null;
  editable: boolean;
  /** A genre holding an uploaded picture cannot be shared at all. Said
      here, before the press, rather than as a refusal after it. */
  hasPictures: boolean;
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
            {hasPictures
              ? "Genres with your own pictures in them stay private, so nothing you upload is reachable by a link."
              : "Anyone with the link can read it and practise it. No account needed."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Sharing"
          disabled={busy || !editable || hasPictures}
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
