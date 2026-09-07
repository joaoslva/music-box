/**
 * Probes the terminal for Kitty keyboard protocol support.
 *
 *   node scripts/check-terminal.ts
 *
 * Why this exists: the naive shell version (`printf '\e[?u'`) is unreliable,
 * because the terminal's answer arrives on *stdin* and the shell's line editor
 * consumes it before you can see it. We need raw mode to read the reply
 * ourselves.
 *
 * A supporting terminal answers with CSI ? <flags> u. Everything else stays
 * silent, so absence-of-reply is the negative signal and we need a timeout.
 */

if (!process.stdin.isTTY) {
  console.error("Not a TTY — run this directly in the terminal you want to test.");
  process.exit(2);
}

const TIMEOUT_MS = 300;

process.stdin.setRawMode(true);
process.stdin.resume();

const timer = setTimeout(() => {
  finish(false, "no reply within 300ms");
}, TIMEOUT_MS);

process.stdin.once("data", (chunk: Buffer) => {
  clearTimeout(timer);
  const s = chunk.toString("latin1");
  // Expect ESC [ ? <digits> u
  const m = /\x1b\[\?(\d+)u/.exec(s);
  if (m) finish(true, `flags=${m[1]}`);
  else finish(false, `unexpected reply ${JSON.stringify(s)}`);
});

function finish(supported: boolean, detail: string): void {
  process.stdin.setRawMode(false);
  process.stdin.pause();

  console.log(`TERM              ${process.env.TERM ?? "(unset)"}`);
  console.log(`Kitty protocol    ${supported ? "SUPPORTED" : "NOT supported"}  (${detail})`);

  if (!supported) {
    console.log("\nmusic-box needs key-release events. See docs/setup.md.");
  }
  process.exit(supported ? 0 : 1);
}

// Query current progressive-enhancement flags.
process.stdout.write("\x1b[?u");
