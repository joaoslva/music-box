# Recording, samples and audio takes

## What "record" means here

The word covers four different features. They need different machinery, so keep them
distinct:

| Meaning | Captures | Machinery | Status |
|---|---|---|---|
| **Record a performance** | which notes, when, how hard — stays editable | internal `NoteEvent` capture; *not* MIDI | milestone 2 |
| **Record an audio take** | mic input as a waveform on the timeline | audio track type + `pw-cat --record` + clip editing | **primary want** — milestone 3–4 |
| **Bounce / export** | the finished mix as `.wav` | DSP engine already produces the samples; ~20 lines of header | nearly free, do early |
| **Sampler** | one note mapped across the keyboard | second instrument engine | wanted, lower priority — milestone 4+ |

## Audio takes — the primary want

Confirmed 2026-09-07: the goal is to record himself playing kalimba or singing vocals,
then drop that onto an FL-Studio-style timeline and edit it against the synth parts.
This is an **audio track**, distinct from a sampler.

`Voice.render(out, offset, count)` (below) covers it — an audio clip is just something
that fills a buffer, reading from a file instead of computing. Simpler than a synth
voice: no pitch-shifting, no multisampling.

**Model change (milestone 2):** two track kinds. Note tracks stay Track → Clip → Notes;
audio tracks are Track → AudioClip → `{file, sourceOffset, length, gain, fadeIn, fadeOut}`.

**Storage — supersedes the shared-library note below.** A recorded *instrument* (kalimba
mapped across keys) is owned across songs and belongs in a user library. A *vocal take*
is song content and must travel with the project. So `.mbp` likely becomes a project
**directory** — `song.mbp/` holding `project.json` + `audio/` — rather than a single
file, so takes cannot get separated from the song. Decide when the model is real; the
single-file assumption in §3 is now **open**.

**Tempo — decide before writing the schema.** Notes live in ticks and move when tempo
changes; a recorded take is a fixed number of samples and does not. Anchor an audio
clip's **start in ticks** but keep its **length in samples, unstretched**. Time-stretching
to follow tempo needs a phase vocoder — defer indefinitely. Getting this wrong produces
silent desync that is painful to retrofit.

**Later, not free:** recording over a playing track needs simultaneous capture and
playback, and the captured audio arrives late by the round-trip latency, so it must be
shifted back to line up. Standard DAW latency compensation.

## Sampler — why the kalimba is the easy case

The two hard problems in sampler design are **loop points** and release tails. A
sustaining instrument (violin, organ, pad) outruns its recording on a held note, so you
must find a click-free loop inside the sustain. That is the fiddly part.

A kalimba is plucked percussion — it decays to silence on its own. **Record the whole
note, let it play out, never loop.** Most of the difficulty disappears.

**Multisampling.** The naive approach — record one note, pitch-shift the rest by changing
playback rate — fails because resampling changes duration *and* timbre together. An
octave up is half as long and thin; an octave down is twice as long and muddy. Real
samplers record several notes and map each to a keyboard *zone*, so any played note is
within a semitone or two of a real recording.

The kalimba is ideal here: every tine is already a discrete pitch, so recording all
8–17 tines covers the instrument completely, possibly with **no pitch-shifting at all**.

## Design consequence for milestone 1a

A synth voice *computes* audio; a sampler voice *reads* it. Both fill a buffer, so make
that the contract instead of hardcoding an oscillator:

```ts
interface Voice {
  noteOn(pitch: number, velocity: number): void;
  noteOff(): void;
  render(out: Float32Array, offset: number, count: number): void;
  readonly active: boolean;   // so the allocator can reclaim it
}

interface Instrument {
  createVoice(): Voice;
}
```

`SamplerVoice` then reads from a `Float32Array` instead of calling `Math.sin`, and the
allocator, envelope, mixer and sink are untouched. Additive, not a rewrite.

## Where samples live — amends the `.mbp` decision

Audio cannot live in the project JSON (base64 would bloat it and destroy diffability).
But a recorded kalimba is **an instrument you own**, not song content — recorded once,
used across many songs. So it goes in a user-level library:

```
~/.local/share/music-box/samples/kalimba/
  C4.wav  D4.wav  E4.wav  ...
  kalimba.json      <- zone map: which file covers which notes
```

Projects reference instruments by name; `.mbp` stays a single diffable JSON file.
Bundling samples for sharing a project is a later problem.

## Capture hardware on this machine (2026-09-07)

`arecord -l` -> card 1, `ALC287 Analog`; PipeWire source id **59**
(`alsa_input.pci-0000_05_00.6.analog-stereo`). Recording works today:

```bash
pw-cat --record --target 59 kalimba-C4.wav
```

Caveat: that is the built-in laptop mic and a kalimba is quiet, so expect room and
handling noise. Fine for fun; a cheap USB mic would be a real upgrade if the sampler
becomes a favourite feature. Not a blocker for anything.

## Why MIDI is not sound — the one-line version

The same C major triad, measured 2026-09-07:

```
chord.mid        58 bytes    instructions
chord.wav    192,044 bytes    the resulting sound     (3,311x larger)
```

MIDI stores intent, so it stays editable: swap the instrument, change tempo without
pitch-shifting, fix one note, transpose the key. Audio bakes all of that in. That
tradeoff is why both formats need to exist in the app.
