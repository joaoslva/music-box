# Setup

Prerequisites for running music-box, and how to verify them.

## 1. Install a terminal with Kitty keyboard protocol support

**Why:** standard terminals send a byte when a key goes *down* and nothing when it
comes *up*. No release event means no note-off, no held chords, no sustain — you
cannot build a playable instrument on it. The Kitty keyboard protocol adds
press/repeat/**release** as distinct events, plus genuinely simultaneous keys.

Current status on this machine: **not supported** (`TERM=xterm-256color`, no reply
to the probe).

## Option A — apt (recommended, simplest)

```bash
sudo apt update
sudo apt install kitty
```

Ubuntu 26.04 ships a recent Kitty. The keyboard protocol has been in since v0.20,
so any packaged version is new enough.

## Option B — official installer (always latest, no root)

```bash
curl -L https://sw.kovidgoyal.net/kitty/installer.sh | sh /dev/stdin
```

Installs to `~/.local/kitty.app` and touches no system packages. Add to PATH:

```bash
ln -sf ~/.local/kitty.app/bin/kitty ~/.local/bin/kitty
```

## Alternatives

Ghostty, WezTerm, and foot all implement the protocol if you prefer one of them.
Kitty is the reference implementation, which is the safest target while building.

> You do **not** have to switch your daily-driver terminal. You only need one
> available to run music-box in.

---

## 2. Verify

Open **Kitty**, `cd` into this project, and run:

```bash
node scripts/check-terminal.ts
```

Expected:

```
TERM              xterm-kitty
Kitty protocol    SUPPORTED  (flags=0)
```

Exits 0 on success, 1 if unsupported. Note that `node` runs the `.ts` file
directly — Node 24 strips types natively, so there's no build step.

Do **not** use the shell one-liner `printf '\e[?u'` — the terminal's answer lands
on stdin and the shell eats it before you see it. That probe reports false
negatives.

---
