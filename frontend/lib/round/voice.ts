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
const SPEECH_FLOOR = 0.01;

/** The room can never be read as quieter than this, so a digital-silence
    recording does not make every ratio above it satisfiable by nothing. */
const FLOOR = 0.005;

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

  async start(): Promise<boolean> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: CONSTRAINTS });
    } catch {
      // Refused, or no device. Not an error anybody needs to see: they
      // came here to talk, not to grant permissions.
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
      this.ticker = setInterval(() => {
        analyser.getFloatTimeDomainData(frame);
        this.levels.push(level(frame));
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

  /** Stops everything and hands back what was heard. Safe to call twice
      and safe to call after a failed start. */
  async stop(): Promise<Heard> {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;

    const settings = this.stream?.getAudioTracks()[0]?.getSettings() ?? null;
    const audio = await this.finish();

    this.stream?.getTracks().forEach((track) => track.stop());
    void this.context?.close().catch(() => {});
    this.stream = null;
    this.context = null;

    const segments = segmentsFrom(this.levels);
    this.levels = [];
    return { segments, audio, filename: filenameFor(this.type), settings };
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
