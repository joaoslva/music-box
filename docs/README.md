# music-box docs

| Doc | What is in it |
|---|---|
| [setup.md](setup.md) | Prerequisites — Kitty terminal, how to verify the keyboard protocol |
| [decisions.md](decisions.md) | Settled architectural choices and why. Treat as closed |
| [architecture.md](architecture.md) | Layering, the `Voice` contract, latency, threading, testing strategy |
| [roadmap.md](roadmap.md) | Milestones and status |
| [midi.md](midi.md) | What MIDI actually is, and how much of it we use |
| [recording.md](recording.md) | The four meanings of "record"; audio takes vs. sampler |
| [chord-engine.md](chord-engine.md) | Music theory behind the chord engine |
| [input.md](input.md) | Kitty keyboard protocol, parsing, and its gotchas |
| [chord-pad.md](chord-pad.md) | The playable instrument: key bindings and design |

## Conventions

- Decisions live in `decisions.md`. If one is reopened, amend it there rather
  than contradicting it elsewhere.
- Findings verified on the machine carry a date, because hardware and package
  versions drift.
- Anything discovered the hard way (a bug, a gotcha, a wrong assumption) gets
  written down with *why* it was wrong, not just what the fix was.
