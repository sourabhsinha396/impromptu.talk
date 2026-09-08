import { MinuteBar, Transcript, WAITING } from "@/components/round/report";
import { Ping } from "@/components/site/ping";
import { Placeholder } from "@/components/site/placeholder";
import {
  advice,
  at,
  axes,
  bands,
  clock,
  distinctWords,
  fit,
  RUN_ON,
  sentenceCaption,
  slices,
  type Band,
  type Report,
} from "@/lib/report";
import { cn } from "@/lib/utils";

/* The same round as the ordinary report, drawn to be filmed.

   People point a phone at this. A laptop held up, or a phone on a stand
   in front of the screen, and the reel is a vertical crop of the middle
   of it. The ordinary report is drawn for somebody reading a laptop at
   arm's length - a 40 pixel wave, 12.5 pixel numbers, four bands in two
   columns - and none of that survives a camera and a compressor.

   So this is not a zoom. Every measure becomes a card, because a filled
   box with an edge holds at any distance where a row of text on a white
   field does not; nothing is thinner than four pixels; the verdict is
   carried by colour rather than by grey text; and the whole reading is
   shown rather than the summary, since a person who is filming has a
   screen to fill and a viewer who has stopped to look.

   Every number here is already stored on the round: the same arithmetic
   the round's own page draws, so nothing new is measured and no second
   call is made. A card whose numbers this round does not have is not
   drawn at all, which is how a free round shows the measures and no
   verdict rather than a box saying nothing.

   Drawn by hand rather than with a chart library, for the reason the
   ordinary report's bands are: this is the home page, where the first
   paint is measured, and a track, a band and a pentagon are not worth a
   hundred kilobytes of charting. */
export function FilmingReport({
  report,
  length,
  day,
  topic,
  href,
}: {
  report: Report | null;
  length: number;
  /** The streak, said as a word in the head rather than as a tile: the
      header pill already carries it on every page. */
  day?: number;
  /** The topic just spoken on. Only used while the round is being read
      back: once the reading lands it comes off the report itself, so the
      head row is the same row before and after and does not move. */
  topic?: string;
  href?: string;
}) {
  if (!report) return <Waiting length={length} day={day} topic={topic} />;
  if (!report.heard) {
    return <p className="text-xl font-semibold">We could not hear you. Check your microphone.</p>;
  }

  /* The line under the wave says what the wave is showing, not the
     report's headline: the headline is about the worst measure, and that
     measure has a card of its own three inches to the right. */
  const worstGap = report.pauses.filter((pause) => pause.awkward).sort((a, b) => b.seconds - a.seconds)[0];
  const minute = [
    worstGap
      ? `A ${Math.round(worstGap.seconds)} second gap at ${clock(worstGap.at)}.`
      : "No gap long enough to notice.",
    report.fillers ? `${report.fillers} um${report.fillers === 1 ? "" : "s"}, drawn where they were said.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const rows = bands(report);
  const shape = axes(report);
  const words = slices(report);
  const longest = Math.max(0, ...report.sentences.map((sentence) => sentence.words));
  const worst = rows.find((row) => advice(row) !== null);
  const next = worst ? advice(worst) : null;

  return (
    <div className="w-full text-left">
      <Head topic={report.topic} day={day} length={length} />

      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <Card title="Your minute" className="sm:col-span-2">
          <div className="mt-1.5">
            <MinuteBar report={report} length={length} ticks={report.filler_times} film />
          </div>
          <p className="mt-auto pt-2 text-[15px] text-muted">{minute}</p>
        </Card>

        {report.case && (
          <Card title="Answered the topic">
            <p
              className={cn(
                "font-display text-[40px] leading-none font-semibold",
                report.case.answered === "no" ? "text-warn" : "text-accent-strong",
              )}
            >
              {report.case.answered === "yes" ? "Yes" : report.case.answered === "half" ? "Half" : "No"}
            </p>
            <p className="mt-2 text-[15px] leading-snug">{report.case.verdict}</p>
          </Card>
        )}

        {shape.length >= 3 && (
          <Card title="The shape">
            <Shape rows={shape} />
          </Card>
        )}

        {rows.map((row) => (
          <Card key={row.key} title={row.label}>
            <Meter band={row} />
          </Card>
        ))}

        {words.length > 0 && (
          <Card title="Words you lean on" className="sm:col-span-2">
            <div className="mt-1.5 flex flex-wrap gap-2">
              {words.slice(0, 6).map((word) => (
                <span
                  key={`${word.kind}-${word.word}`}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[15px] font-semibold",
                    word.kind === "filler" ? "bg-warn/20" : "bg-accent/20",
                  )}
                >
                  {word.word}
                  <b className="tabular-nums">{word.count}</b>
                </span>
              ))}
            </div>
            {report.words !== null && (
              <p className="mt-auto pt-2 text-sm text-muted">
                {report.words} words, {distinctWords(report)} of them different.
              </p>
            )}
          </Card>
        )}

        {report.restarts.length > 0 && (
          <Card title="Restarts">
            <Value
              number={`${report.restarts.length}`}
              unit={
                report.repeats.length
                  ? `and ${report.repeats.length} phrase${report.repeats.length === 1 ? "" : "s"} said twice`
                  : "and nothing said twice"
              }
            />
            <p className="mt-1.5 text-sm leading-snug text-muted">&ldquo;{report.restarts[0].quote}&rdquo;</p>
          </Card>
        )}

        {longest > 0 && (
          <Card title="Sentences">
            <Value
              number={`${longest}`}
              unit={report.ended_clean ? "longest, and you landed the last" : "longest, and the last trailed off"}
              out={longest > RUN_ON}
            />
            <p className="mt-auto pt-2 text-sm text-muted">{sentenceCaption(report)}</p>
          </Card>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        {next && <p className="text-[15px] text-muted">Next time: {next.charAt(0).toLowerCase()}{next.slice(1)}</p>}
        {href && (
          <p className="flex items-center gap-2 text-[15px]">
            <a href={href} className="font-semibold text-accent-strong underline underline-offset-4 hover:text-ink">
              See the full report
            </a>
            <Ping />
          </p>
        )}
      </div>

      {/* Left as a fold, at any size. A paragraph of transcript cannot be
          read on camera, so it is here for the person and never for the
          shot. */}
      <Transcript report={report} />
    </div>
  );
}

/* The topic, the day and the length: the row above the board, drawn the
   same whether the reading has landed or not, so it does not move when it
   does. While waiting the topic comes down from the round; afterwards it
   comes off the report, which is the same string. */
function Head({ topic, day, length }: { topic?: string; day?: number; length: number }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
      <p className="font-display text-[21px] leading-tight font-semibold text-accent">{topic}</p>
      <p className="text-[15px] font-semibold text-muted">
        {day && day > 1 && <span className="text-ink">Day {day}</span>}
        {day && day > 1 ? " · " : ""}
        {clock(length)}
      </p>
    </div>
  );
}

/* The board as its own empty frame, while the round is being read back.

   The same idea as the reading report's wait and for the same reason, at
   the size a camera keeps: cards with an edge, nothing thinner than the
   real thing, and the board at the height it will be, so the shot does not
   jump when the numbers arrive. Ten cards, because ten is what a round
   with everything measured draws.

   Named nowhere, deliberately. Which cards a round earns depends on what
   came back - the verdict is Pro's, half the measures need a transcript -
   so a ghost card with "Answered the topic" on it would be a promise
   broken on every free round. Unnamed, the frame says only that a report
   of about this size is coming.

   The head row is the exception and is real: the topic and the clock are
   the round's own, held by the browser, and were never waiting on
   anything. */
function Waiting({ length, day, topic }: { length: number; day?: number; topic?: string }) {
  return (
    <div className="w-full text-left" role="status">
      <Head topic={topic} day={day} length={length} />
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <Card className="sm:col-span-2">
          <Placeholder className="mt-1.5 h-24 rounded-card" />
          <div className="mt-1 flex justify-between text-[13px] tabular-nums text-muted">
            <span>0:00</span>
            <span>{clock(length)}</span>
          </div>
          <Placeholder className="mt-auto h-4 w-[70%]" delay={80} />
        </Card>
        {MEASURES.map((width, index) => (
          <Card key={width}>
            <Placeholder className={cn("mt-2 h-10", width)} delay={140 + index * 70} />
            <Placeholder className="mt-2.5 h-[13px] rounded-full" delay={140 + index * 70} />
            <Placeholder className="mt-1.5 h-3 w-[40%]" delay={140 + index * 70} />
          </Card>
        ))}
        <Card>
          <Placeholder className="mt-2 h-[124px] rounded-card" delay={630} />
        </Card>
        <Card className="sm:col-span-2">
          <div className="mt-2 flex flex-wrap gap-2">
            {CHIPS.map((chip, index) => (
              <Placeholder key={chip} className={cn("h-8 rounded-full", chip)} delay={700 + index * 70} />
            ))}
          </div>
          <Placeholder className="mt-auto h-4 w-[52%]" delay={770} />
        </Card>
      </div>
      <p className="mt-4 text-[15px] text-muted">{WAITING}</p>
    </div>
  );
}

/* Seven measure-shaped cards at the widths the real numbers take, so the
   board is a board and not a grid of identical grey squares. Seven, plus
   the wide minute, the shape and the wide words, fills the same three rows
   a round with everything measured draws, so the wait is the height of the
   thing it is waiting for. */
const MEASURES = ["w-[70%]", "w-[52%]", "w-[60%]", "w-[44%]", "w-[66%]", "w-[48%]", "w-[58%]"];
const CHIPS = ["w-24", "w-20", "w-28"];

function Card({ title, className, children }: { title?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex min-w-0 flex-col rounded-card border-[1.5px] border-line bg-card2 px-4 py-3", className)}>
      {title && <h3 className="text-sm font-bold text-muted">{title}</h3>}
      {children}
    </div>
  );
}

/** The number and the word for where it landed, which is the pair every
    measure card is made of. */
function Value({ number, unit, out = false }: { number: string; unit: string; out?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={cn("font-display text-[40px] leading-none font-semibold whitespace-nowrap", out && "text-warn")}>
        {number}
      </span>
      <span className="text-right text-sm font-semibold text-muted">{unit}</span>
    </div>
  );
}

/* The ordinary report's band at the weights a camera keeps: a 13 pixel
   track instead of 6, a 24 pixel marker instead of 12, and the value warm
   as well as the marker, because on a phone screen a coloured dot two
   pixels across is the first thing to go. */
function Meter({ band }: { band: Band }) {
  const start = at(band.good[0], band.scale);
  const width = at(band.good[1], band.scale) - start;
  const mark = at(band.value, band.scale);
  const inside = band.value >= band.good[0] && band.value <= band.good[1];
  return (
    <>
      <Value number={band.shown} unit={band.verdict} out={!inside} />
      <div className="relative mt-2.5 h-[13px] w-full rounded-full bg-line">
        <div className="absolute inset-y-0 rounded-full bg-accent/40" style={{ left: `${start}%`, width: `${width}%` }} />
        <div
          className={cn(
            "absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-card2",
            inside ? "bg-ink" : "bg-warn",
          )}
          style={{ left: `${mark}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[13px] text-muted">
        <span>{band.ends[0]}</span>
        <span>{band.ends[1]}</span>
      </div>
    </>
  );
}

/* Five measures as one shape, this round filled and your usual as a
   dashed outline. The point of it is the glance: a lopsided pentagon says
   which way a round went wrong before any number has been read. */
function Shape({ rows }: { rows: Band[] }) {
  const point = (index: number, value: number) => {
    const angle = ((-90 + (index * 360) / rows.length) * Math.PI) / 180;
    const distance = (44 * value) / 100;
    return [60 + distance * Math.cos(angle), 60 + distance * Math.sin(angle)];
  };
  const path = (pick: (row: Band) => number | null) =>
    rows.map((row, index) => point(index, pick(row) ?? 0).join(",")).join(" ");
  const usual = rows.some((row) => row.usual !== null && row.usual !== undefined);

  return (
    <>
      <svg viewBox="0 0 120 120" className="mt-1 max-h-[150px] w-full" role="img" aria-label="This round against your usual">
        {[100, 66, 33].map((ring) => (
          <polygon
            key={ring}
            points={rows.map((_, index) => point(index, ring).join(",")).join(" ")}
            fill="none"
            stroke="var(--line)"
            strokeWidth={1.5}
          />
        ))}
        {usual && (
          <polygon
            points={path((row) => fit(row, row.usual ?? null))}
            fill="none"
            stroke="var(--line-strong)"
            strokeWidth={2}
            strokeDasharray="4 4"
          />
        )}
        <polygon
          points={path((row) => fit(row))}
          fill="color-mix(in oklab, var(--accent) 45%, transparent)"
          stroke="var(--accent-strong)"
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </svg>
      <p className="mt-auto pt-2 text-sm text-muted">
        {rows.filter((row) => fit(row) === 100).length} of {rows.length} comfortable
        {usual ? ", against your usual" : ""}.
      </p>
    </>
  );
}
