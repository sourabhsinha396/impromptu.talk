# Microphone levels

How the round decides it heard somebody, what the numbers actually are on real hardware, and the two faults that made a working microphone report silence. Written after chasing "we could not hear you" through a browser that was not at fault.

The code is `frontend/lib/round/voice.ts`. The decisions are the 2026-09-08 bullets in `DECISIONS.md`; this file is the measurement behind them, kept because the next person to touch a threshold needs the numbers and not just the verdict.

## The chain

Every check in the round hangs off one number: the RMS of a frame of samples, taken fifty times a second.

| Constant | Value | What it decides |
|---|---|---|
| `DEAD_FLOOR` | 0.0001 | Below this there is no signal at all: a muted device, the wrong input, a headset that never connected. A live microphone in a silent room never reads this low. |
| `FLOOR` | 0.005 | The room can never be read as quieter than this, so a digital-silence recording cannot satisfy every ratio above it with nothing. |
| `SPEECH_FLOOR` | 0.01 | Below this, whatever the shape of it, nothing in the round was a voice. |
| `SEPARATION` | 3 | Voice under `room * 3` means one flat level throughout. |
| `HEARD_RATIO` | 0.05 | The share of the round that must carry sound. Mirrors `HEARD_FLOOR` in `backend/apps/runs/analysis.py`. |

`segmentsFrom` reads the room as the minimum level clamped to `FLOOR`, and the voice as the ninetieth percentile. Then:

- voice below `SPEECH_FLOOR` returns no segments at all, and the round is unheard.
- voice below `room * SEPARATION` returns **one segment covering the whole round**. This is the degenerate branch. It is meant for somebody who genuinely talked without stopping, and it is indistinguishable in the data from a round that was simply too quiet to segment.
- otherwise the thresholds sit between the two ends and the real timeline is measured.

That middle branch matters more than it looks. It passes `HEARD_RATIO` with a ratio of exactly 1.0, so the round is reported as heard, while carrying no pauses, no restarts and no trail-off. A round can be broken and cheerful at the same time.

## What real hardware gives

Measured in Chrome on a Realtek microphone array, ordinary speaking voice, sitting at a normal desk distance, six seconds of talking. Ninetieth percentile unless said otherwise.

| Reading | p90 | Peak |
|---|---|---|
| Live element of the array | 0.021 | 0.0296 |
| Its second element | 0.0032 | 0.0045 |
| What the app was reading, the mono down-mix of the two | 0.0105 | 0.0146 |
| Same voice with the browser's default processing on | 0.0572 | 0.1160 |

Against `SPEECH_FLOOR` of 0.01, the app was reading an ordinary voice at 1.05 times the floor.

## Fault one: the down-mix halved the voice

An `AnalyserNode` always analyses mono. Given a stereo input it down-mixes as `(left + right) / 2`. A microphone array whose second element carries nothing therefore arrives at exactly half its real loudness, and 0.021 became 0.0105.

The consequences ran in both directions:

- A few percent quieter and the voice fell under `SPEECH_FLOOR`, `segmentsFrom` returned nothing, and the done screen said "we could not hear you" to somebody who had just talked for a minute.
- A few percent louder and it passed, but at 0.0105 the voice was still under `room * SEPARATION` (the room being clamped to `FLOOR`, so the line was 0.015), so it took the degenerate branch and returned one segment covering the round. Reported as heard, with an empty timeline.

So the same person at the same desk was heard or not heard at random, and the rounds that passed were not much better than the ones that failed.

Asking the device for one channel does not help. The constraint already says `channelCount: 1` and Chrome hands back two anyway, which the track's own `getSettings()` confirms.

Taking channel zero would have fixed this machine and broken one whose live element is the other. So each channel now gets its own analyser through a `ChannelSplitter` and the loudest wins. That is also the only reading that survives two elements in opposite phase, which cancel to near nothing when averaged.

### Why this looked like a browser bug

Edge heard the same voice on the same machine throughout, so the fault presented as Chrome-only for a day. It was not. Every browser was halving the voice; Edge happened to land on the passing side of a line the app was sitting on top of.

The lesson is worth more than the fix: when two browsers disagree about the same engine's behaviour, the interesting question is usually not what differs between them but what the app is doing that leaves so little margin that anything at all can tip it.

## Fault two: the context that was never resumed

Not the cause of the above, and written down because it was chased first and because the failure it produces is indistinguishable from the real one.

The microphone opens when the topic lands, which is a render and not a press, so the `AudioContext` is built with no user gesture behind it. A browser's autoplay rule can leave such a context suspended, and a suspended context's analyser answers with a buffer of exact zeros however loud the room is. The old code asked to resume exactly once, at creation, which is the moment a browser is least likely to say yes, and dropped the refusal into a `catch`.

`wake` now runs from the level ticker and takes effect the instant somebody presses anything, which is how the round reaches the speaking anyway. It is a guard, not a fix for anything observed: the Chrome that produced the real fault reported the context running.

## How to measure this again

Neither fault is visible from inside the app, which is the reason both survived. A halved level draws as a working meter, only shorter. A suspended context draws as a microphone that is off. Nothing on the screen distinguishes either from a quiet room.

So measure outside the app, on the app's own origin:

1. Serve a scratch page from `http://localhost:3009`. Not `file://`: the device list comes back empty there and the microphone permission is a different one from the app's, so the reading says nothing about the round.
2. Open the stream with the app's own constraints, and a second one with `{ audio: true }` for comparison.
3. Tap the source directly for what an `AnalyserNode` gives, and split the channels for what each element gives, and sample all of them off one clock so the numbers describe the same moments of the same voice.
4. Report peak, mean, room and the ninetieth percentile for each, and run a copy of `segmentsFrom` over the collected levels so the page prints the verdict the round would reach rather than a number somebody has to interpret.
5. Also print `track.getSettings()`. That is where `channelCount: 1` being ignored shows up.

The page used for this was deleted after the fix rather than kept in `public/`, since a live diagnostic route on the marketing origin is a surface nobody asked for. It is a twenty-minute rebuild from the list above.

## What is still thin

With the down-mix fixed, an ordinary voice on that array sits at 0.021. That is:

- twice `SPEECH_FLOOR`, so the round is heard
- 1.4 times the 0.015 line where the timeline degenerates into a single segment

Neither is much room for somebody softly spoken, sitting further back, or on a quieter device than this one. Every number in that chain was chosen before anybody had measured cheap laptop hardware.

The floors have deliberately **not** been moved on one device's reading, because setting a threshold from a single measurement is how the next version of this bug gets made. The honest fix is to set them from the distribution: the ninetieth percentile is derivable from `Report.segments`, which is stored raw on every round for exactly this reason, so the levels of real rounds can settle where the floors belong. That is worth its own card.
