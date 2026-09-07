# Roadmap

Milestones and status.

## Milestone 1 — "play chords live"

Each step ends somewhere you can hear or test the result. 1a–1c don't depend on
each other.

- [x] **1a — Audio engine skeleton.** DONE 2026-09-07. Polyphonic voice allocator with
      oldest-voice stealing, ADSR with real note-off, `pw-cat` sink, clock-paced engine,
      offline WAV render. Built against the `Voice`/`Instrument`/`RenderSource`
      interfaces so the sampler and audio clips are additive.
      *Verify:* `npm test` (25 passing) and `npm run demo` -- 0 underruns, peak 0.408.
- [x] **1b — Input layer, Kitty as first source.** DONE 2026-09-07. Protocol
      enable/disable/detect, a pure `parseKeyEvents()` parser, piano keymap, terminal
      state restoration on every exit path. 19 tests.
      *Verify:* `node scripts/demo-1b.ts --play` in Kitty — hold several keys at once.
      See [input.md](input.md).
- [x] **1c — Chord engine.** DONE 2026-09-07. Diatonic chords by stacking thirds in
      the scale (works for any mode), quality detection, roman numerals, borrowed
      chords, secondary dominants, harmonic function, voice leading, and a weighted
      suggestion engine where every result explains itself. 28 tests.
      *Verify:* `node scripts/demo-1c.ts` — improvises a progression and plays it.
      See [chord-engine.md](chord-engine.md).
- [x] **1d — Wire it together.** DONE 2026-09-07. `ChordPad` (`src/app/`) holds the
      instrument logic — degrees in, `NoteEvent`s out, with voice leading, extensions,
      suspensions, borrowed chords, secondary dominants, transpose and mode toggle.
      `renderChordPad` (`src/tui/`) is a pure `(state, width) -> lines` view. 20 tests.
      *Verify:* `npm run mb` in Kitty. Hold 1-7.
- [x] **1e — TUI proper.** DONE 2026-09-07. `Screen` (`src/tui/screen.ts`) owns the
      alternate buffer, cursor and a 30ms resize debounce, and skips redrawing an
      unchanged frame. The pad row draws suggestion strength as a meter under each
      degree. `mb` is a real CLI entry point; `scripts/demo-1d.ts` is gone. 11 tests.
      *Verify:* `npm run mb`.

**Milestone 1 is complete.** `npm run mb` is a playable instrument.

## Later milestones

2. Core model + `mb render song.mbp out.wav`
3. Step sequencer / piano roll, with SGR-1006 mouse drag for FL-style editing
4. Instruments and effects chains
5. MIDI import/export, recording

## On the chord engine

Nopia's real trick isn't magic — it removes wrong answers. Buttons are diatonic
*functions* in a key, not absolute chords. Plan:

- Number row `1`–`7` → diatonic degrees in the current key
- Modifiers for extensions (triad → 7 → 9 → sus), inversions, secondary dominants,
  modal interchange
- Suggestions from a weighted transition model over functional roles
  (tonic → subdominant → dominant) plus a corpus of common progressions

Rules and weights, not ML — which means it's explainable when a suggestion feels
wrong. The `.mbp` `key` track is what lets this stay context-aware across a song
rather than being one global setting.

---

---

## Parked ideas — not forgotten

### Derive transition weights from a MIDI corpus

The chord engine's transition weights are hand-authored from common practice,
so they encode a fairly Western, fairly tonal sensibility. Large libraries of
free `.mid` files exist. Importing a corpus, extracting chord progressions and
counting real transitions would replace guessed numbers with measured ones.

This is a concrete, load-bearing reason the MIDI **import** path earns its
place — not just export for interop. See [midi.md](midi.md).

Worth doing after the sequencer exists (milestone 2-3), since parsing `.mid`
into the internal model is shared work. Keep the hand-authored table as the
fallback for when a corpus is unavailable, and as a sanity check on whatever
the corpus produces.

### TUI resize

Measured 2026-09-07, before any TUI existed: building a full-screen worst-case
frame (a colour change every cell) costs **0.41ms at 120x40**, 0.79ms at
200x50, against a 5.33ms audio block. Frame construction is not the bottleneck.

The real risks, in order:
1. **Resize storms** — dragging a window edge fires dozens of SIGWINCH per
   second. Debounce to ~30ms and repaint once on settle.
2. **Redraw blocking audio** — same thread. Mitigated by the numbers above for
   now; the fix when it bites is moving the synth to a `worker_thread`, which
   the `RenderSource` boundary already anticipates.

**Design rule, free if adopted now:** rendering must be a pure function of
`(state, width, height)`. Then resize needs no special handling — it is just a
recompute with different numbers. Incremental invalidation is where TUI resize
actually goes wrong.

