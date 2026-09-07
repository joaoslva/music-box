# music-box

A terminal music-making app in TypeScript. Chord-first: press a key, hear a
chord in the current key, see where the harmony can go next.

Inspired by FL Studio's editing, GarageBand's play-and-record flow, and the
Nopia / HiCord chord devices.

## Requirements

- **Node 24+** — runs `.ts` directly via native type stripping, no build step
- **PipeWire** — audio output goes through `pw-cat`
- **A terminal with the Kitty keyboard protocol** — Kitty, Ghostty, WezTerm or
  foot. Required for real key-release events, without which held notes are
  impossible. See [docs/setup.md](docs/setup.md).

## Quick start

```bash
node scripts/check-terminal.ts   # confirm the keyboard protocol works
npm run mb                       # play the chord pad
npm run check                    # typecheck + tests
```

Then press `1` to `7`.

## Scripts

| Command | Does |
|---|---|
| `npm run mb` | Launch the chord pad (`node src/cli.ts --help` for options) |
| `npm run demo` | Play a scale and a chord through the speakers |
| `npm run demo -- --wav out.wav` | Render the same events to a file instead |
| `npm test` | Run the test suite |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | Typecheck, then test |

## Layout

```
src/
  audio/    DSP: voices, envelopes, polyphony, engine, sink   <- knows nothing about the terminal
  core/     music model + theory + chord engine               <- pure, no I/O
  input/    Kitty keyboard protocol -> NoteEvents
  tui/      pure (state, width) -> lines views, plus Screen
  app/      the instrument and its wiring
  cli.ts    the `mb` entry point
docs/       decisions, architecture, roadmap
scripts/    demos and diagnostics
test/       node:test suites
```

Docs are in [docs/](docs/README.md) — start with
[decisions.md](docs/decisions.md) for why things are the way they are.
