/* Hearing the round: when somebody was talking, and the audio to send.

   Two jobs that share one microphone. The **timeline** is measured here,
   in the browser, off the loudness envelope: when sound started, every gap
   and how long each held. That is arithmetic rather than a guess about
   language, so it is exact, costs nothing and works in every browser, and
   it is what the free report is made of. The **recording** goes to the
   backend and on to a transcriber, which is the half that costs money and
   the only thing that can count an "um".

   The timeline is measured here and not derived from the transcript on
   purpose. A recogniser stops on silence and has to be restarted, and this
   exercise is deliberately full of long silences, so a recogniser owning
   the timeline would be wrong at exactly the events being measured.

   The splitting logic below is pure and takes an array of numbers, so it
   is tested without a microphone, a browser or a clock. */

/** How often the level is sampled. Fifty a second is 20ms a frame, fine
    enough to place a pause to a twentieth of a second and coarse enough
    that a minute is 3000 numbers rather than a million. */
export const SAMPLE_HZ = 50;

/** The loud end of the round, as a percentile rather than the maximum, so
    one door slam does not become the voice everything else is measured
    against. */
const VOICE_PERCENTILE = 0.9;

/** Where the thresholds sit **between** the room and the voice, rather
    than at a multiple of the room.

    The first version took the quiet tenth as the room, and it broke for
    exactly the people this is built for: somebody who talks for fifty of
    the sixty seconds has a tenth percentile that lands inside their own
    speech, so the room came back as the voice and the round reported
    silence. Measuring from both ends fixes that and survives a single
    dropped frame too, since the threshold is a fraction of the range and
    not a multiple of its bottom.

    Two numbers rather than one, because a single threshold chatters:
    every syllable boundary would open and close it and a fluent minute
    would report forty pauses. */
const OPEN_AT = 0.25;
const CLOSE_AT = 0.12;

/** Below this, whatever the shape of it, nothing in the room was a voice.
    This is what stops a silent recording having its own hiss promoted to
    speech by a threshold derived from that same hiss. */
export const SPEECH_FLOOR = 0.01;

/** The room can never be read as quieter than this, so a digital-silence
    recording does not make every ratio above it satisfiable by nothing. */
const FLOOR = 0.005;

/** Below this there is no signal at all, which is a different fact from a
    quiet room and is the one the topic screen acts on.

    A live microphone always carries a noise floor: even a silent room
    reads a thousandth or more, because the room, the preamp and the
    converter all contribute. A muted device, the wrong input or a headset
    that never connected reads digital zero. Three least-significant bits
    of sixteen-bit audio, so dither and a denormal still count as nothing
    while any real room does not. */
export const DEAD_FLOOR = 0.0001;

/** How long the input has to read as nothing before the topic screen says
    so. Long enough that a device still settling after `getUserMedia` is
    not accused, short enough to land well before anybody presses a
    button. */
export const DEAD_AFTER_MS = 2000;

/** How long into the speaking somebody is left alone before being told
    that nothing is arriving. Under this, an ordinary slow start would be
    called a broken microphone. */
export const DEAF_AFTER_MS = 4000;

/** With no separation between the two ends, the round is all one level.
    Past `SPEECH_FLOOR` that means somebody talked without stopping, which
    is a real minute and not a failure to detect one. */
const SEPARATION = 3;

/** Speech stays open this long after dropping quiet, so the stop inside a
    "t" and the join between two words do not split a phrase in half. */
const HANGOVER_MS = 200;

/** Shorter than this is a cough, a click or a chair. */
const MIN_SPEECH_MS = 120;

export type Segment = [number, number];

/** Whether an open input is giving nothing at all.

    Pure, and separate from the class, so the rule that decides what
    somebody is told about their microphone is tested without a browser.
    Undecided until there are enough samples to be sure: a verdict from
    three frames would accuse every device that takes a moment to start. */
export function isDead(recent: number[], hz: number = SAMPLE_HZ): boolean {
  const needed = Math.round((DEAD_AFTER_MS / 1000) * hz);
  if (recent.length < needed) return false;
  return recent.slice(-needed).every((value) => value < DEAD_FLOOR);
}

/** The monotonic clock, which a system clock change cannot move. Falls
    back where `performance` is missing, which is server rendering rather
    than any browser this runs in. */
function clock(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

/** Root mean square of one frame of samples: how loud it was, in the same
    units the thresholds are ratios of. */
export function level(frame: Float32Array): number {
  let sum = 0;
  for (const sample of frame) sum += sample * sample;
  return Math.sqrt(sum / (frame.length || 1));
}

/** The two ends of the round: the quietest it ever got, and how loud it
    got when somebody was talking. Sorting a copy, since the caller's
    array is the recording and is read again after this. */
function ends(levels: number[]): { room: number; voice: number } {
  const sorted = [...levels].sort((a, b) => a - b);
  const at = Math.min(sorted.length - 1, Math.floor(sorted.length * VOICE_PERCENTILE));
  return { room: Math.max(sorted[0], FLOOR), voice: sorted[at] };
}

/** Loudness over time into "when there was a voice".

    Returns seconds from the top of the round, which is what the backend
    stores and what the pause map is drawn from. Deliberately knows nothing
    about words: a hum and a sentence are both sound, and telling them
    apart is the transcriber's job and the transcriber's bill. */
export function segmentsFrom(levels: number[], hz: number = SAMPLE_HZ): Segment[] {
  if (!levels.length || hz <= 0) return [];

  const { room, voice } = ends(levels);
  // Nothing here was loud enough to be anybody's voice.
  if (voice < SPEECH_FLOOR) return [];
  // One level throughout, and above the speech floor: somebody talked
  // without ever stopping, which is a whole minute of speaking and not a
  // round that failed to detect one.
  if (voice < room * SEPARATION) return [[0, round(levels.length / hz)]];

  const range = voice - room;
  const open = room + range * OPEN_AT;
  const close = room + range * CLOSE_AT;
  const hangover = Math.round((HANGOVER_MS / 1000) * hz);
  const minFrames = Math.round((MIN_SPEECH_MS / 1000) * hz);

  const segments: Segment[] = [];
  let start: number | null = null;
  let quietFor = 0;

  levels.forEach((value, frame) => {
    if (start === null) {
      if (value >= open) {
        start = frame;
        quietFor = 0;
      }
      return;
    }
    if (value >= close) {
      quietFor = 0;
      return;
    }
    quietFor += 1;
    if (quietFor > hangover) {
      // The hangover is not speech, so the segment ends where the voice
      // did. Counting it would shorten every pause by a fifth of a second.
      const end = frame - quietFor + 1;
      if (end - start >= minFrames) segments.push([start / hz, end / hz]);
      start = null;
      quietFor = 0;
    }
  });

  if (start !== null) {
    const end = levels.length - quietFor;
    if (end - start >= minFrames) segments.push([start / hz, end / hz]);
  }

  return segments.map(([a, b]) => [round(a), round(b)]);
}

function round(seconds: number): number {
  return Math.round(seconds * 100) / 100;
}

/** What `getUserMedia` is asked for, and the most important object in this
    file.

    The browser's defaults assume a phone call. Noise suppression removes
    low-energy non-speech sound, which is exactly what "um" and "uh" are,
    and automatic gain flattens the volume fade that trail-off is read
    from. Left on, they hand the transcriber audio already scrubbed of the
    thing being counted, and the filler detection that was paid for never
    arrives. */
export const CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
  channelCount: 1,
};

/** Containers differ by browser and nothing here should care: Chrome and
    Firefox give Opus in webm or ogg, Safari gives AAC in mp4. Every one of
    them is accepted by both transcribers, so the first supported type
    wins and the filename follows it. */
const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];

function pickType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

/** What the browser would do if asked, learned without asking.

    `navigator.permissions.query` never prompts, which is the whole point:
    it lets the page know whether opening the microphone would be silent
    or would throw a dialog over the topic. Safari does not implement it
    for the microphone and Firefox is partial, so anything unknown is
    treated as "ask" and the person is invited rather than surprised. */
export type MicState = "granted" | "denied" | "ask";

export async function micState(): Promise<MicState> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return "denied";
  try {
    const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
    if (status.state === "granted") return "granted";
    if (status.state === "denied") return "denied";
    return "ask";
  } catch {
    return "ask";
  }
}

export type Heard = {
  segments: Segment[];
  audio: Blob | null;
  filename: string;
  /** What the browser actually granted. Safari ignores some constraints,
      so what was asked for and what happened are not the same fact, and
      the one worth keeping is what happened. */
  settings: MediaTrackSettings | null;
};

export const NOTHING: Heard = { segments: [], audio: null, filename: "round.webm", settings: null };

/** One round's listening, from permission to blob.

    Never throws. A refused microphone, a browser without `MediaRecorder`
    and a dead device all end the same way: the round still happened, the
    streak still counts, and there is simply no report. Nothing in the
    speaking loop may depend on this working. */
export class Listener {
  private stream: MediaStream | null = null;
  private context: AudioContext | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private levels: number[] = [];
  private ticker: ReturnType<typeof setInterval> | null = null;
  private type = "";
  /** The last level read, which is all the meter under the clock wants. */
  private latest = 0;
  /** A rolling couple of seconds of levels, kept whatever the round is
      doing, so the topic screen can tell a dead input from a quiet room
      before anybody has spoken a word. */
  private recent: number[] = [];
  /** The loudest frame since the speaking began. */
  private loudestSince = 0;
  /** The microphone was asked for and did not arrive: refused, absent, or
      a browser without one. Nothing will ever be heard, and the topic
      screen says the same line for this as for a dead device. */
  private refused = false;
  /** The microphone being asked for, while it is. */
  private opening: Promise<boolean> | null = null;
  /** When the speaking minute began, on the monotonic clock. */
  private markedAt: number | null = null;
  /** While the round is paused, when it was paused; and how long it has
      spent paused so far. Time the clock did not count is time the
      speaker was not being measured on. */
  private pausedAt: number | null = null;
  private pausedFor = 0;

  /** How loud it is right now, for the meter under the clock. Nought
      whenever nothing is open, which draws as five bars at rest. */
  get level(): number {
    return this.latest;
  }

  /** Nothing at all is arriving: refused, absent, or open and reading
      digital silence. Answered before the clock starts, which is the
      whole point of it. */
  get dead(): boolean {
    return this.refused || isDead(this.recent);
  }

  /** Whether anything since `mark` has been loud enough to be a voice.

      Deliberately the same floor `segmentsFrom` uses to decide a round had
      no voice in it, so the warning during the round and the report after
      it can never disagree: whatever this says at four seconds is what the
      done screen would have said at sixty. */
  get heard(): boolean {
    return this.loudestSince >= SPEECH_FLOOR;
  }

  /** Opens the microphone, once. Calling this while it is open, or still
      being asked for, is the same call and not a second microphone.

      The topic screen calls it on every landing, and every respin and
      every reset back from prep or speak lands there again. The first
      version opened another stream, another context and another ticker
      each time and closed none of them, so every leaked ticker kept
      pushing into the same timeline at fifty a second and after N spins
      the round was measured N times fast: run 30 was a 58 second round
      whose sound ended at 226 seconds. The microphone also stayed open
      behind the leaked streams. */
  async start(): Promise<boolean> {
    if (this.stream) return true;
    if (!this.opening) {
      this.opening = this.open().finally(() => {
        this.opening = null;
      });
    }
    return this.opening;
  }

  private async open(): Promise<boolean> {
    // Cleared here rather than in `stop`, so a retry from the topic screen
    // is judged on the device it just opened and never on the two seconds
    // of silence that made somebody press the link.
    this.recent = [];
    this.latest = 0;
    this.refused = false;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      this.refused = true;
      return false;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: CONSTRAINTS });
    } catch {
      // Refused, or no device. Not an error anybody needs to see: they
      // came here to talk, not to grant permissions. Recorded, though,
      // because the round now says once that it cannot hear anything.
      this.refused = true;
      return false;
    }

    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.context = new Ctor();
      const source = this.context.createMediaStreamSource(this.stream);
      const analyser = this.context.createAnalyser();
      // Small window: the level is wanted often, not precisely.
      analyser.fftSize = 512;
      source.connect(analyser);
      const frame = new Float32Array(analyser.fftSize);
      const keep = Math.round((DEAD_AFTER_MS / 1000) * SAMPLE_HZ);
      this.ticker = setInterval(() => {
        if (this.pausedAt !== null) return;
        analyser.getFloatTimeDomainData(frame);
        const loudness = level(frame);
        this.latest = loudness;
        if (loudness > this.loudestSince) this.loudestSince = loudness;
        this.recent.push(loudness);
        if (this.recent.length > keep) this.recent.shift();
        this.levels.push(loudness);
      }, 1000 / SAMPLE_HZ);
    } catch {
      // No Web Audio is survivable: the recording still happens and the
      // words still arrive, and only the timeline is missing.
    }

    return true;
  }

  /** The speaking minute starts here.

      Split from `start` so the permission prompt lands on the topic screen
      rather than on the clock. A browser asking for the microphone at the
      instant somebody is meant to begin talking would cost them the
      seconds they are being measured on, and it only ever happens on the
      first round, which is the worst one to spoil.

      Zeroing the levels here is what makes the timeline start at the first
      spoken second rather than at the permission dialog, and holding the
      recorder until now is what keeps prep out of the transcript and off
      the bill. */
  mark(): void {
    this.levels = [];
    this.chunks = [];
    this.loudestSince = 0;
    this.markedAt = clock();
    this.pausedAt = null;
    this.pausedFor = 0;
    this.type = pickType();
    if (!this.stream || !this.type) return;
    try {
      this.recorder = new MediaRecorder(this.stream, { mimeType: this.type });
      this.recorder.ondataavailable = (event) => {
        if (event.data.size) this.chunks.push(event.data);
      };
      this.recorder.start();
    } catch {
      this.recorder = null;
    }
  }

  /** The round is paused, so the recording and the timeline pause with
      it. Camera mode lets somebody stop the clock mid-round with the
      space bar; without this the microphone kept listening through it and
      the round came back with a hole the speaker never left, of exactly
      the length of their pause. Both are safe to call twice. */
  pause(): void {
    if (this.markedAt === null || this.pausedAt !== null) return;
    this.pausedAt = clock();
    if (this.recorder?.state === "recording") this.recorder.pause();
  }

  resume(): void {
    if (this.pausedAt === null) return;
    this.pausedFor += clock() - this.pausedAt;
    this.pausedAt = null;
    if (this.recorder?.state === "paused") this.recorder.resume();
  }

  /** Stops everything and hands back what was heard. Safe to call twice
      and safe to call after a failed start. */
  async stop(): Promise<Heard> {
    // A reset that lands while the microphone is still being asked for
    // waits for the answer, so the stream that arrives a moment later is
    // closed here rather than left open under the idle screen.
    if (this.opening) await this.opening;
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;

    const settings = this.stream?.getAudioTracks()[0]?.getSettings() ?? null;
    const audio = await this.finish();

    this.stream?.getTracks().forEach((track) => track.stop());
    void this.context?.close().catch(() => {});
    this.stream = null;
    this.context = null;

    const segments = segmentsFrom(this.levels, this.rate());
    this.levels = [];
    this.latest = 0;
    this.markedAt = null;
    this.pausedAt = null;
    this.pausedFor = 0;
    return { segments, audio, filename: filenameFor(this.type), settings };
  }

  /** How often the ticker actually fired, which is not what it was asked
      for.

      `setInterval` fires at most every twenty milliseconds and less often
      under load, on a busy main thread or in a tab the browser has
      throttled. Dividing sample indices by a nominal fifty therefore read
      the whole round short: a minute arriving as fifty seconds of it,
      with the opening stall, every pause and the trail-off compressed by
      the same factor, and the drawn wave stopping before the end of a
      round somebody spoke to the bell.

      Measured against the clock instead, the timeline ends where the
      round ends whatever the browser did with the ticker. */
  private rate(): number {
    if (this.markedAt === null || !this.levels.length) return SAMPLE_HZ;
    // The round's own running time: what the clock counted, which is what
    // the backend is told the round was.
    const upTo = this.pausedAt ?? clock();
    const elapsed = (upTo - this.markedAt - this.pausedFor) / 1000;
    if (elapsed <= 0) return SAMPLE_HZ;
    // A ticker cannot fire faster than it was asked to, so anything above
    // the nominal rate is a clock nobody should trust.
    return Math.min(this.levels.length / elapsed, SAMPLE_HZ);
  }

  private finish(): Promise<Blob | null> {
    const recorder = this.recorder;
    this.recorder = null;
    if (!recorder || recorder.state === "inactive") return Promise.resolve(this.blob());
    return new Promise((resolve) => {
      recorder.onstop = () => resolve(this.blob());
      try {
        recorder.stop();
      } catch {
        resolve(this.blob());
      }
    });
  }

  private blob(): Blob | null {
    if (!this.chunks.length) return null;
    const blob = new Blob(this.chunks, { type: this.type || "audio/webm" });
    this.chunks = [];
    return blob;
  }
}

export function filenameFor(type: string): string {
  if (type.includes("ogg")) return "round.ogg";
  if (type.includes("mp4")) return "round.mp4";
  return "round.webm";
}
