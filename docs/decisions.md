# Decisions

Settled architectural choices and why. Treat as closed unless
reopened deliberately.

## Summary

| Area | Choice | Rationale |
|---|---|---|
| Sound source | Own DSP synth in TS | No native deps; deterministic; offline WAV render makes audio testable |
| Audio output | Raw PCM piped to `pw-cat --playback --raw -` | Machine runs PipeWire; zero native modules, no node-gyp |
| Terminal | Kitty protocol **required** | Real key-release → held notes and true chords |
| File format | JSON `.mbp`, versioned | Human-readable and git-diffable |
| Time representation | PPQ ticks (960) + separate tempo map | Never store seconds; tempo changes must not corrupt note timing |
| Dependencies | Near-zero at runtime | Node 24 gives native TS execution and `node:test` |
| Dev dependencies | `typescript`, `@types/node` only | Node strips types without checking them; `tsc --noEmit` catches real errors. Added 2026-09-07 |

---

## Naming

`.mbx` was rejected: it is the historical Outlook Express / Eudora mailbox extension,
and desktop MIME databases still carry that association. Using **`.mbp`** for project
files and **`mb`** for the CLI.

