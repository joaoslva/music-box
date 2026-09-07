# Architecture

How the pieces fit, and the rules that keep them separable.

## Layering

The rule that keeps this buildable: **`core/` knows nothing about audio, and
`audio/` knows nothing about the terminal.**

```
core/       music model + theory + chord engine   ← pure, no I/O, 100% testable
audio/      DSP graph, voices → sample buffers    ← testable by rendering to WAV
transport/  look-ahead scheduler, ticks → events
io/         pw-cat sink, .mbp load/save, MIDI
tui/        rendering + input                     ← disposable, replaceable
```

## How sound actually gets out

```
note data → scheduler → voices (osc → env → filter) → mixer
         → Float32 (−1..1) → Int16 → bytes → pw-cat stdin
         → PipeWire → ALSA → DAC → speakers
```

Two things to remember:

- **The pipe is the clock.** `pw-cat` consumes at exactly real-time speed. When its
  buffer fills, `stream.write()` returns `false` and you wait for `'drain'`. No
  `setInterval`, no timer drift.
- **Audio must not share a thread with the TUI.** A big grid redraw on the audio
  thread causes a buffer underrun — an audible click. Eventually the synth moves to
  a `worker_thread`. Not needed on day one; a larger buffer hides it while learning.

A working ~70-line proof of this whole pipeline was validated on 2026-09-03:
2.6s of audio, 0.13s of CPU, four sine voices ≈ 5% of one core.

---

---

## The Voice contract

The single most important interface in the codebase, because it is what makes
future instrument types additive rather than rewrites:

```ts
export interface Voice {
  noteOn(pitch: number, velocity: number): void;
  noteOff(): void;
  /** ADDS count mono samples into out. Additive -- never clears the buffer. */
  render(out: Float32Array, offset: number, count: number): void;
  readonly active: boolean;
}
```

A synth voice *computes* its samples from math. A sampler voice will *read*
them from a recording. An audio clip will *read* them from a file. All three
satisfy this, so the voice allocator, envelope, mixer and sink never change.

`RenderSource` is the same idea one level up -- anything that can fill a block.
`Polyphony` implements it today; the timeline mixer will implement it later.
`AudioEngine` knows nothing else about what it is playing.

## Latency and why the engine uses a clock

The obvious design is to let pipe backpressure pace the render loop: write
until `stream.write()` returns false, wait for `drain`, repeat. That is correct
for bulk playback and wrong for an instrument.

A default OS pipe buffer is 64KB. At 256 frames x 2 channels x 2 bytes = 1024
bytes per block, that is ~64 blocks, or roughly **340ms** of audio queued before
`write()` ever pushes back. Unplayable.

So `AudioEngine` paces against the wall clock instead, keeping only
`TARGET_BUFFER_SEC` (15ms) in flight. Pipe backpressure remains as a safety net.
`engine.underruns` counts times the buffer ran dry -- non-zero means raise the
target or make rendering cheaper.

Total latency is roughly `TARGET_BUFFER_SEC` + pw-cat's own latency (10ms) +
hardware.

## Threading

Everything currently runs on the main thread. That is fine while the only work
is rendering audio, but a full-screen TUI redraw on the same thread will cause
a buffer underrun -- an audible click. When that starts happening, the synth
moves to a `worker_thread` and receives note events over a message channel.

Not needed yet. The `RenderSource` boundary is where that split will happen.

## Testing strategy

The DSP is a pure buffer-producer, so it can be rendered offline far faster
than realtime with no audio device involved. `renderOffline()` plus
`encodeWav()` means tests assert on **samples**, not on whether something
sounded right.

This is what caught the envelope-timing bug in 1a: a `release: 0.25` that
audibly rang for over two seconds. Nobody would have noticed by ear that it was
wrong rather than merely slow.
