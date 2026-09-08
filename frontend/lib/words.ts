/* The minute as a cloud: every word counted, sized and shaded by how
   often it was said, and packed into a box.

   All of it is arithmetic over the transcript the round already carries,
   so nothing new is measured and no second call is made - the same rule
   the wave follows, which is drawn from a timeline the browser took
   itself.

   No DOM in here. Placing words needs to know how wide each one will be,
   and only a canvas knows that, so the caller passes a `measure` in. That
   keeps this a table of tests rather than a picture nobody can check. */

export type Word = { word: string; count: number };

/** Every word said and how often, most first.

    Nothing is dropped: pronouns, conjunctions and articles all count
    (owner's call). A stop word list would take out "the" and "and",
    which are the top of every round ever spoken and say nothing about
    anybody - but they are also most of what a minute is, and a cloud
    that hides them is a cloud of a minute nobody spoke. Ties break on
    the word so the same transcript always tallies the same way. */
export function tally(transcript: string): Word[] {
  const counts = new Map<string, number>();
  for (const raw of transcript.toLowerCase().split(/[^\p{L}\p{N}']+/u)) {
    const word = raw.replace(/^'+|'+$/g, "");
    if (!word) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

/** How large a word is drawn, against the most said one.

    The square root of the share, not the share: sizing straight off the
    count gives the top word the whole box and leaves everything else a
    hedge at the bottom. Every word cloud since the first one has used
    the root, and this is why. */
export function size(count: number, top: number): number {
  return Math.round(MIN_SIZE + (MAX_SIZE - MIN_SIZE) * Math.sqrt((count - 1) / Math.max(1, top - 1)));
}

const MIN_SIZE = 13;
const MAX_SIZE = 62;

/** Which step of the accent ramp a word is drawn in, 0 the strongest.

    Shade says the same thing as size, on purpose: at a glance the deep
    words are the big words, so the picture has a middle and edges rather
    than being a field of one colour. Five steps and not twenty because
    most of a minute is words said once, and that whole bottom is one
    tie. */
export function step(count: number, top: number): number {
  if (count <= 1) return STEPS - 1;
  const from = Math.ceil((1 - Math.sqrt((count - 1) / Math.max(1, top - 1))) * (STEPS - 1));
  return Math.min(STEPS - 1, Math.max(0, from));
}

export const STEPS = 5;

export type Placed = Word & { size: number; step: number; down: boolean; x: number; y: number };
export type Box = { x: number; y: number; width: number; height: number };
export type Measure = (word: string, size: number) => number;

/* The box the packer works in. Not pixels: the drawing is an SVG that
   scales to whatever column it lands in, and the view is trimmed to what
   was actually placed, so these are only the proportions the cloud grows
   into. */
const WIDTH = 800;
const HEIGHT = 380;
/* A quarter of the words are turned, which is enough to interlock the
   long ones without the picture becoming a puzzle. */
const TURNED = 0.32;
/* Space around each word, so two of them never touch. */
const PAD = 3;

/** Where every word goes, and the box they ended up filling.

    Biggest first, each one walked out along a spiral from the middle
    until it clears everything already down. **Where a word sits carries
    nothing**: a word is near the middle because it was placed early,
    which is because it was said often, which its size already says. The
    page has to say so, because a reader who thinks the arrangement means
    something is reading noise.

    Across or turned a quarter and never in between: a quarter is the
    only rotation somebody reads without tilting their head, and words at
    forty-five degrees are why most word clouds cannot be read at all.

    The order the words are turned in comes off a fixed seed, so the same
    round draws the same cloud on every visit. A picture that rearranged
    itself between two looks at one minute would be saying something had
    changed when nothing had. */
export function place(words: Word[], measure: Measure): { placed: Placed[]; box: Box } {
  const top = words[0]?.count ?? 1;
  const taken: { x: number; y: number; w: number; h: number }[] = [];
  const placed: Placed[] = [];
  const random = seeded(SEED);

  for (const [index, entry] of words.entries()) {
    const px = size(entry.count, top);
    // The first word is never turned: it is the one somebody reads first.
    const down = index > 0 && random() < TURNED;
    const length = measure(entry.word, px);
    const height = px * 0.82;
    const w = (down ? height : length) + PAD * 2;
    const h = (down ? length : height) + PAD * 2;

    for (let tick = 0; tick < 3000; tick += 1) {
      const angle = tick * 0.32;
      const radius = 1.4 * angle;
      // Wider than tall, because words are: a round spiral in a wide box
      // leaves the corners empty and the middle crowded.
      const x = WIDTH / 2 + radius * Math.cos(angle) * 1.9 - w / 2;
      const y = HEIGHT / 2 + radius * Math.sin(angle) - h / 2;
      if (x < 0 || y < 0 || x + w > WIDTH || y + h > HEIGHT) continue;
      if (taken.some((seat) => x < seat.x + seat.w && x + w > seat.x && y < seat.y + seat.h && y + h > seat.y)) continue;
      taken.push({ x, y, w, h });
      placed.push({
        ...entry,
        size: px,
        step: step(entry.count, top),
        down,
        x: x + PAD + (w - PAD * 2) / 2,
        y: y + PAD + (h - PAD * 2) / 2,
      });
      break;
    }
  }

  return { placed, box: bounds(taken) };
}

const SEED = 7;

/* Trimmed to what was actually placed, so the cloud fills the column it
   is drawn in rather than floating inside the box the packer was given. */
function bounds(taken: { x: number; y: number; w: number; h: number }[]): Box {
  if (!taken.length) return { x: 0, y: 0, width: WIDTH, height: HEIGHT };
  const margin = 6;
  const left = Math.min(...taken.map((seat) => seat.x)) - margin;
  const top = Math.min(...taken.map((seat) => seat.y)) - margin;
  const right = Math.max(...taken.map((seat) => seat.x + seat.w)) + margin;
  const bottom = Math.max(...taken.map((seat) => seat.y + seat.h)) + margin;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/* A generator and not Math.random, so the packing is the round's and not
   the visit's. */
function seeded(from: number): () => number {
  let state = from >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
