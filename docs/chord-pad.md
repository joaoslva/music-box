# The chord pad

The playable instrument.

```bash
npm run mb                    # or: node src/cli.ts
node src/cli.ts --key A --minor
node src/cli.ts --help
```

| Piece | Role |
|---|---|
| `src/app/chord-pad.ts` | The instrument. Degrees in, `NoteEvent`s out. No I/O |
| `src/tui/chord-pad-view.ts` | Pure `(state, width) -> lines` view |
| `src/tui/screen.ts` | Owns the terminal: alt buffer, cursor, resize debounce |
| `src/app/chord-pad-app.ts` | Glue — keyboard, audio, screen |
| `src/cli.ts` | Argument parsing, the `mb` entry point |

## Keys

| Key | Does |
|---|---|
| `1`–`7` | Play the diatonic chord on that degree, held while the key is down |
| `shift` + `1`–`7` | Borrowed chord — the same degree from the parallel mode |
| `ctrl` + `1`–`7` | Secondary dominant, `V/x` |
| `q` | Cycle extension: triad → seventh → ninth |
| `w` | Cycle suspension: none → sus2 → sus4 |
| `e` | Toggle voice leading (worth hearing off once) |
| `-` `=` | Transpose the key down / up a semitone |
| `\` | Swap to the parallel mode — same tonic, opposite colour |
| `,` `.` | Octave down / up |
| `r` | Clear the progression history |
| `esc`, `ctrl-c` | Quit |

## Why degrees rather than chords

Buttons are harmonic **functions** in a key, not absolute chords. Press `4` in
C major and you get F; transpose to E♭ and the same key gives A♭. Nothing you
press is wrong, which is the whole Nopia idea and what makes it playable
without knowing theory.

Degrees are also why `transpose()` needs no bookkeeping: history is stored as
degrees, so it stays valid across key changes.

## Design

`ChordPad` holds **no I/O and no terminal state**. It takes degrees and returns
`NoteEvent[]`, exposing a `state` snapshot. That is what let the whole
instrument be unit tested — voice leading, held-chord tracking, extension
cycling and transposition all have tests that never open a terminal or an audio
device.

Several degrees may sound at once and are released independently, tracked by
degree rather than by pitch. So a release matches its press even if you let go
of `shift` first, and overlapping chords do not steal each other's notes.

## The view is a pure function

`renderChordPad(state, width) -> string[]`. No cursor tracking, no cached
layout, no incremental invalidation.

This is the design rule adopted after measuring resize cost (see
[roadmap.md](roadmap.md)): resize becomes a recompute with a different number
rather than a special case. It also means the layout is *testable* — there are
tests asserting no line overflows at widths from 20 to 200 columns.

The view degrades rather than wrapping. At 80 columns everything shows; at ~44
the help lines collapse and fewer suggestions fit; at ~26 the key moves to its
own line and the pitch list truncates with an ellipsis.

## The pad row

The seven degrees are drawn as columns, with a meter under each showing how
strongly it is suggested:

```
   1       2       3       4       5       6       7
   I       ii      iii     IV      V       vi      vii°
   C       Dm      Em      F       G       Am      B°
   █       ▁       ·       ▁       ▮       ▂       ·
```

The point is that the suggestion appears **under the key you would press**,
rather than in a list you have to read across and translate back into a
fingering. A held pad is inverted and shows `▮` — it is the chord you are on,
not a chord you might go to, and giving it an empty meter read as "weak
suggestion" instead of "playing now".

Below roughly 48 columns the pads stack vertically instead, keeping all seven
visible rather than truncating the row.

## What it shows

The sounding chord as roman numeral, absolute name and MIDI pitches — plus the
ranked next chords with percentages and, underneath, the reason the top one was
offered. Playing I–vi–IV–V and seeing *"continues I–vi–IV–V"* appear is the
suggestion engine explaining itself, which is the point of using rules and
weights instead of a model.
