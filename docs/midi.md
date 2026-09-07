# MIDI

What MIDI actually is, and how much of it music-box uses.

## Scope decision

"MIDI" is five separate things, and each is its own decision:

| Layer | What it is | Verdict |
|---|---|---|
| **Pitch numbering** | note 60 = C4, velocity 0–127 | **Adopt now.** Universal and free; already in the audio spike. |
| **Wire messages** | Note On `0x9n`, Note Off `0x8n`, CC, pitch bend | **Boundary only** — never the internal event type. |
| **Standard MIDI File** (`.mid`) | chunked format, VLQ delta times | **Yes, milestone 2–3.** ~80 lines. Escape hatch + free input material. |
| **Device input** | USB/DIN controller via ALSA sequencer | **Someday/maybe.** No controller owned; app is keyboard-driven by design. Do not build speculatively. |
| **Clock / sync** | tempo-lock to other apps | **No.** Revisit only with a concrete reason. |

## Why MIDI is *not* the internal event format

Tempting, but it bakes in 1983:

- **7-bit resolution.** Velocity 0–127, when we synthesize in float32.
- **Paired note-on/note-off.** A sequencer wants a note with a *duration*. The paired
  model means hunting for the matching off, plus orphan and stuck-note handling forever.
- **16 channels.** An artificial cap we don't have.
- **It cannot carry meaning.** The chord engine knows "this is V7 of the current key,
  third inversion." MIDI can only say "these four pitches." That metadata is exactly
  what powers suggestions, reharmonisation, and transpose-on-key-change — flatten to
  MIDI internally and it is gone.

**Rule: rich model inside, MIDI at the boundaries.**

## Architectural consequence

Notes arrive from three sources, so they all emit one internal type:

```
input/
  types.ts             NoteEvent { pitch, velocity, source, ... }
  sources/
    kitty-keyboard.ts  → NoteEvent
    midi-device.ts     → NoteEvent   (later)
    chord-engine.ts    → NoteEvent[]
```

`midi-device.ts` is listed for shape only — it is **not planned work**. No controller
is owned (confirmed 2026-09-07), and the app is deliberately keyboard-driven. The
abstraction costs nothing now and means adding a controller later is additive rather
than a rewrite.

Why `.mid` still earns its place even solo:
1. **Escape hatch.** Without export, everything made in music-box is trapped in
   music-box. `.mid` is how a track gets into a real DAW to be finished.
2. **Free input material.** Large libraries of `.mid` files exist — loading one to
   study or remix its progression feeds the chord engine real data.

## Verified on this machine (2026-09-07)

No controller attached, but the whole stack is present: ALSA sequencer, PipeWire
advertising **UMP-MIDI2**, and a **`Midi Through`** virtual loopback (port `14:0`) for
testing without hardware.

A full round trip was proven with **zero npm dependencies** — a Standard MIDI File
written by a ~40-line encoder, played with `aplaymidi -p 14:0`, captured with
`aseqdump -p 14:0`:

```
Note on    0, note 60, velocity 100
Note on    0, note 64, velocity 100
Note on    0, note 67, velocity 100
Note off   0, note 60, velocity 64
Note off   0, note 64, velocity 64
Note off   0, note 67, velocity 64
```

Gotcha found while testing: `aseqdump` takes a moment to subscribe to the port. Start
it and let the subscription settle before sending, or you silently lose the opening
events.

Device input options, all dependency-free:
- `aseqdump` as a parseable subprocess (simplest)
- ALSA rawmidi at `/dev/snd/midiC*D*` (lower level; only exists for real hardware)
- `pw-cat --record --midi -`

No `node-midi`, no `easymidi`, no native builds.

## SMF encoding notes

The only fiddly part is the **variable-length quantity** used for delta times: 7 bits
per byte, high bit set on all but the last. Structure is `MThd` (format, ntracks,
division) then `MTrk` chunks of `delta, status, data…`, ending `FF 2F 00`. Set tempo
with the meta event `FF 51 03 <µs per quarter note>`.

A working encoder from the spike lives in the scratchpad; port it when milestone 2
lands.

---
