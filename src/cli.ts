#!/usr/bin/env node
import { ChordPadApp } from "./app/chord-pad-app.ts";
import { SHARP_NAMES, type Key, type ScaleName } from "./core/theory.ts";

const HELP = `
  music-box — a terminal music-making app

  usage: mb [options]

  options:
    -k, --key <note>     key root: C, C#, D, ... (default C)
    -m, --minor          natural minor instead of major
    -o, --octave <n>     starting octave, 1-7 (default 4)
    -h, --help           this message

  in the pad:
    1-7                  play the chord on that degree
    shift + 1-7          borrowed chord from the parallel mode
    ctrl + 1-7           secondary dominant, V/x
    q / w / e            extension / suspension / voice-leading
    - =                  transpose the key
    \\                    swap major and minor
    , .                  octave down and up
    esc, ctrl-c          quit
`;

const argv = process.argv.slice(2);

function option(...names: string[]): string | undefined {
  for (const name of names) {
    const i = argv.indexOf(name);
    if (i !== -1) return argv[i + 1];
  }
  return undefined;
}

const has = (...names: string[]) => names.some((n) => argv.includes(n));

if (has("-h", "--help")) {
  process.stdout.write(`${HELP}\n`);
  process.exit(0);
}

const tonicArg = (option("-k", "--key") ?? "C").toUpperCase();
const tonic = SHARP_NAMES.indexOf(tonicArg as (typeof SHARP_NAMES)[number]);
if (tonic === -1) {
  process.stderr.write(`unknown key "${tonicArg}" — expected one of ${SHARP_NAMES.join(" ")}\n`);
  process.exit(1);
}

const scale: ScaleName = has("-m", "--minor") ? "naturalMinor" : "major";
const key: Key = { tonic, scale };

const octaveArg = Number.parseInt(option("-o", "--octave") ?? "4", 10);
const octave = Number.isFinite(octaveArg) ? Math.max(1, Math.min(7, octaveArg)) : 4;

const app = new ChordPadApp({ key, octave });

try {
  await app.start();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
