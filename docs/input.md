# The input layer

Lives in `src/input/`. Turns terminal bytes into `NoteEvent`s.

## Why the Kitty protocol

A legacy terminal writes one byte when a key goes **down** and nothing when it
comes up. No release event means no note-off, no held chords, no sustain. There
is also no way to distinguish autorepeat from re-pressing, and Ctrl+I is
literally the same byte as Tab.

The Kitty keyboard protocol replaces this with structured events.

## Flags, and why flag 8 is not optional

```
ESC [ > 11 u        push flags (1 | 2 | 8)
ESC [ < u           pop them again
ESC [ ? u           query; a supporting terminal answers CSI ? <flags> u
```

| Flag | Meaning |
|---|---|
| 1 | Disambiguate escape codes — Ctrl+I stops colliding with Tab |
| 2 | **Report event types** — press / repeat / release |
| 8 | **Report all keys as escape codes** |

Flag 8 matters more than it looks. With only 1 and 2, ordinary printable keys
still arrive as bare bytes with no release event — so `a`, the letter you
actually want to play notes with, would be exactly as untrackable as on a
legacy terminal. Both 2 and 8 are required for held notes.

## Wire format

```
CSI key[:alternate] [; modifiers[:event]] [; text] u
```

- **key** — Unicode codepoint in the base layout (lowercase, unshifted)
- **modifiers** — bitfield **plus one**, so `1` means no modifiers.
  shift 1, alt 2, ctrl 4, super 8
- **event** — 1 press, 2 repeat, 3 release

`ESC[97;5:3u` is "ctrl held, `a` released".

## Parsing

`parseKeyEvents(buffer)` is a **pure function** returning `{ events, rest }`.
Terminal input is the hardest part of this app to test interactively, so the
parsing is fully separated from the I/O and exercised with byte fixtures.

`rest` carries an incomplete trailing sequence into the next chunk. This is not
theoretical: a `read()` boundary lands mid-escape-sequence routinely, and
without it you drop or corrupt whatever key was in flight.

Non-`u` CSI sequences (cursor reports, mouse events) are skipped without losing
stream sync, since they share the same input stream.

## Three gotchas, all learned the hard way

**Ctrl+C does not arrive as SIGINT.** Raw mode disables signal generation, so
Ctrl+C comes through as an ordinary key event (codepoint 99 with the ctrl
modifier). It must be handled explicitly or the app cannot be quit.

**Autorepeat must be ignored.** Holding a key fires repeat events continuously.
Turning each into a `noteOn` retriggers the envelope over and over — a
machine-gun stutter instead of a sustained note. `PianoKeymap.translate()`
drops `repeat` deliberately.

**Terminal state must be restored on every exit path.** Raw mode and the pushed
protocol flags both outlive the process. Leaving either set makes the user's
shell unusable until they run `reset`. `KittyKeyboard` registers handlers for
`exit`, `SIGINT` and `SIGTERM`.

## Keyboard layout

The layout trackers and DAWs have used for decades — two QWERTY rows arranged
like piano keys, home row white, the row above black:

```
q 2 w 3 e r 5 t 6 y 7 u     upper octave
z s x d c v g b h n j m     lower octave
```

`,` and `.` shift the octave, clamped to 0-8.

## Not a MIDI message

`NoteEvent` carries a float velocity and a `source`, and will later carry
harmonic meaning from the chord engine. MIDI's 7-bit velocity and paired
note-on/note-off are a 1983 constraint we convert to only at the boundary.
See [midi.md](midi.md).
