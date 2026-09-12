import { useLayoutEffect, useRef } from "react";

import { Button } from "@/components/site/button";
import { CopyIcon, SpinIcon } from "@/components/site/icons";
import type { Topic } from "@/lib/bank";
import { SPEEDS } from "@/lib/round/prefs";
import { longWordSize, readLength } from "@/lib/round/warmups";

/* The warm-up round: a passage, a lead-in, and the words moving up the
   screen while you read them out loud.

   There is no clock on any of these screens, and that is the design and
   not an omission. A ring measures a fixed length you are trying to fill;
   this is a fixed text you are trying to keep pace with, so the scroll is
   the timer and the words are their own progress bar. Falling behind is
   the failure, and you can hear it happen, which is why none of this needs
   a microphone, a transcript or a model. */

const ROW = "flex flex-wrap items-center justify-center gap-3";

/* About seven lines in the window, sized off the viewport HEIGHT first.
   What is being held constant is how many lines are on screen, and that is
   a height question: a width-led clamp bottoms out on a narrow window and
   puts thirteen lines back, which reads as a wall and makes the eye search
   for its place every time it comes back from the camera. The 10vw term
   only stops a tall narrow phone rendering one word a line.

   The column is narrow on purpose - three or four words a line - because a
   mouth already running at 180 a minute cannot also afford eye travel. */
const PASSAGE_TYPE =
  "font-display font-semibold tracking-[-0.022em] text-accent text-center " +
  /* The line height is an em rather than the usual unitless number, which
     is what lets a long word take a smaller font-size without shrinking
     its line box: an em computes once here and children inherit the
     length, where a number would have each child recompute its own and
     leave the lines unevenly spaced. */
  "text-[clamp(1.6rem,min(9vh,10vw),4.2rem)] leading-[1.62em] break-words text-pretty";

/* The passage, with its longest words sized to fit. */
function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\s+)/).map((token, index) => {
        const size = longWordSize(token);
        return size ? (
          <span key={index} style={{ fontSize: size }}>
            {token}
          </span>
        ) : (
          token
        );
      })}
    </>
  );
}

/* The words a person reads, drawn once and used on both screens, so the
   preview and the scroller can never disagree about what is coming. */
export function PassagePreview({ topic, words, genre }: { topic: Topic; words: number; genre: string }) {
  return (
    <div className="w-full max-w-[620px] rounded-2xl border border-line bg-card px-6 py-5 text-left">
      <p className="mb-3 flex items-baseline justify-between gap-3">
        {/* Empty when the page's heading already named this bank. Rendered
            anyway rather than dropped, because the row is a
            `justify-between` pair and one child alone would swing the
            level over to the left. */}
        <span className="text-[13px] font-bold tracking-[0.06em] text-muted uppercase">{genre}</span>
        {/* Difficulty, and it is a label rather than a gate: every passage
            is free at every level, because the hard ones are exactly the
            rows worth filming (docs/DECISIONS.md). */}
        <span className="text-[13px] font-semibold text-muted capitalize">
          {topic.level} &middot; <span className="normal-case">{words} words</span>
        </span>
      </p>
      {/* Faded rather than clipped: the point of this card is to show what
          you are committing to, and a hard edge mid-word reads as a bug. */}
      <p className="m-0 max-h-[8.2em] overflow-hidden text-[15.5px] leading-[1.6] break-words text-ink [mask-image:linear-gradient(#000_68%,transparent)]">
        {topic.text}
      </p>
    </div>
  );
}

/** The passage before it moves: what it says, how fast, and how long the
    clip will run. A creator about to press record needs all three. */
export function PassagePhase({
  topic,
  genre,
  words,
  wpm,
  seconds,
  onStart,
  onSpeed,
  onSpin,
}: {
  topic: Topic;
  genre: string;
  words: number;
  wpm: number;
  seconds: number;
  /* Absent on the server's first paint, which draws the same passage with
     nothing wired to it. The markup matches, so hydration is quiet. */
  onStart?: () => void;
  onSpeed?: (wpm: number) => void;
  onSpin?: () => void;
}) {
  return (
    <>
      <PassagePreview topic={topic} words={words} genre={genre} />
      <div className="mt-6 flex flex-col items-center gap-2.5">
        <span className="text-[13px] font-semibold text-muted" id="speed-label">
          Words a minute
        </span>
        <div
          role="group"
          aria-labelledby="speed-label"
          className="inline-flex overflow-hidden rounded-full border border-line-strong"
        >
          {SPEEDS.map((speed) => (
            <button
              key={speed}
              type="button"
              aria-pressed={speed === wpm}
              onClick={onSpeed ? () => onSpeed(speed) : undefined}
              className={`cursor-pointer px-5 py-[11px] text-[14.5px] font-semibold tabular-nums transition-colors ${
                speed === wpm ? "bg-ink text-surface" : "text-muted hover:text-ink"
              }`}
            >
              {speed}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-4 mb-7 text-[15px] text-muted">
        {/* About <b className="font-bold text-ink">{readLength(seconds)}</b> at this speed. */}
      </p>
      <div className={ROW}>
        <Button size="xl" onClick={onStart}>
          Start reading
        </Button>
        <Button size="lg" variant="ghost" onClick={onSpin} aria-label="Another passage">
          <SpinIcon />
          Another one
        </Button>
      </div>
    </>
  );
}

/** Three, two, one. Not decoration: it is what lets somebody press record,
    sit back and start clean. */
export function ReadyPhase({ digit, wpm }: { digit: number; wpm: number }) {
  return (
    <>
      <p
        aria-hidden
        className="m-0 font-display text-[clamp(5rem,18vw,11rem)] leading-none font-semibold tracking-[-0.04em] tabular-nums text-accent"
      >
        {digit}
      </p>
      <p className="mt-[18px] text-[15px] text-muted" role="status">
        Reading at {wpm} words a minute
      </p>
    </>
  );
}

/** The scroller. The whole surface is the words, and this is the thing
    people record.

    The scroll is one linear transform over the whole reading time rather
    than a position moved on every tick: a transition the compositor owns
    cannot stutter, and a recording of a stuttering teleprompter is
    unusable. The engine's timer decides only when it is over. */
export function ReadingPhase({ topic, seconds, onDone }: { topic: Topic; seconds: number; onDone: () => void }) {
  const column = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLParagraphElement>(null);

  /* Measured and started in the same layout effect, before paint, with a
     forced reflow between the start position and the end one.

     The reflow is what makes the transition begin, and it replaces a
     `requestAnimationFrame` that used to do the job. rAF does not fire in
     a tab the browser has stopped painting, and the failure was silent and
     total: the timer ran, the round ended after its full length, and the
     words never moved once. Somebody whose window was behind another at
     the moment they pressed Start would have read nothing for a minute.
     Reading `offsetHeight` cannot be skipped that way. */
  useLayoutEffect(() => {
    const stage = column.current;
    const passage = text.current;
    if (!stage || !passage) return;
    /* Start with the first lines a third of the way down and end with the
       last ones a third from the top, so a line is never being read at the
       very edge where the mask has already dimmed it. A passage shorter
       than the window travels nowhere rather than backwards. */
    const travel = Math.max(0, passage.getBoundingClientRect().height - stage.getBoundingClientRect().height * 0.45);
    passage.style.transition = "none";
    passage.style.transform = "translateY(0)";
    void passage.offsetHeight;
    passage.style.transition = `transform ${seconds}s linear`;
    passage.style.transform = `translateY(-${travel}px)`;
  }, [topic.slug, seconds]);

  return (
    <div
      ref={column}
      /* Masked top and bottom so words arrive and leave softly. Text cut by
         a hard edge looks like a bug on camera; a soft entry looks like an
         edit somebody paid for. */
      className="relative flex h-[calc(100dvh-var(--header-h))] w-full justify-center overflow-hidden [mask-image:linear-gradient(transparent,#000_18%,#000_82%,transparent)]"
    >
      {/* The query container the long-word rule measures against: cqw is a
          percentage of this box, which is the column a word has to fit. */}
      <div className="w-full max-w-[640px] px-[clamp(18px,4vw,30px)] [container-type:inline-size]">
        <p ref={text} className={`${PASSAGE_TYPE} m-0 pt-[30vh] motion-reduce:transition-none`}>
          <Words text={topic.text} />
        </p>
      </div>
      <button
        type="button"
        onClick={onDone}
        className="absolute right-4 bottom-5 cursor-pointer text-[13px] font-semibold text-muted underline decoration-line-strong underline-offset-4"
      >
        Stop
      </button>
    </div>
  );
}

/** Done. It says only what it can know: nothing was recorded, so the site
    has no idea whether they kept up, and it does not pretend to. */
export function WarmUpDone({
  words,
  wpm,
  best,
  topWpm,
  onAgain,
  onAnother,
  onShare,
  shared,
}: {
  words: number;
  wpm: number;
  best: number;
  topWpm: number;
  onAgain: () => void;
  onAnother: () => void;
  onShare: () => void;
  shared: boolean;
}) {
  const next = SPEEDS[Math.min(SPEEDS.indexOf(wpm) + 1, SPEEDS.length - 1)];
  return (
    <>
      <p className="mb-2.5 font-display text-[clamp(2.2rem,6vw,3.6rem)] leading-[1.05] font-semibold tracking-[-0.035em]">
        {words} words at <span className="text-accent">{wpm}</span> a minute.
      </p>
      <p className="mb-8 max-w-[42ch] text-base leading-[1.5] text-muted">
        Nothing was recorded, so only you know whether you kept up.
        {best > 0 && ` Your fastest on this one was ${best}.`}
      </p>
      <div className={ROW}>
        {/* Again leads and Spin is the ghost, which is the reverse of the
            round's done screen: a warm-up's loop is repetition, not
            variety. At the top speed it simply goes again. */}
        <Button size="xl" onClick={onAgain}>
          {wpm === topWpm ? "Again" : `Again, at ${next}`}
        </Button>
        <Button size="lg" variant="ghost" onClick={onAnother}>
          <SpinIcon />
          Another passage
        </Button>
      </div>
      <button
        type="button"
        onClick={onShare}
        className="mt-[18px] inline-flex cursor-pointer items-center gap-[7px] text-sm font-semibold text-muted"
      >
        <span className="underline decoration-line-strong underline-offset-4">
          {shared ? "Link copied" : "Challenge your friend"}
        </span>
        <CopyIcon size={15} />
      </button>
      {/* The most important line on the screen: a warm-up is the top of the
          funnel and the round is the product. */}
      <p className="mt-[34px] max-w-[46ch] text-sm leading-[1.55] text-muted">
        A warm-up does not build your streak.{" "}
        <a href="/?genre=general" className="font-semibold text-accent-strong underline underline-offset-4">
          Spin a real topic
        </a>{" "}
        and talk for a minute.
      </p>
    </>
  );
}
