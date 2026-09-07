/**
 * Milestone 1c verification: the chord engine driving the audio engine.
 *
 *   node scripts/demo-1c.ts                 improvise in C major
 *   node scripts/demo-1c.ts --key A --minor improvise in A minor
 *   node scripts/demo-1c.ts --wav out.wav   render instead of playing
 *
 * Each chord is chosen by weighted random pick from the suggestion engine, so
 * the progression differs every run but always makes harmonic sense. The
 * reason each chord was chosen is printed alongside it.
 */
import { writeFileSync } from "node:fs";
import { AudioEngine } from "../src/audio/engine.ts";
import { CHANNELS, SAMPLE_RATE } from "../src/audio/constants.ts";
import { renderOffline, type TimedEvent } from "../src/audio/offline.ts";
import { Polyphony } from "../src/audio/polyphony.ts";
import { DEFAULT_SYNTH, SynthInstrument } from "../src/audio/synth.ts";
import { encodeWav } from "../src/audio/wav.ts";
import { chordName, diatonicChord, romanNumeral } from "../src/core/chord.ts";
import { suggestNext } from "../src/core/suggest.ts";
import { keyName, SHARP_NAMES, type Key } from "../src/core/theory.ts";
import { voiceLead } from "../src/core/voicing.ts";

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const value = (name: string) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};

const tonicName = (value("--key") ?? "C").toUpperCase();
const tonic = SHARP_NAMES.indexOf(tonicName as (typeof SHARP_NAMES)[number]);
const key: Key = {
  tonic: tonic === -1 ? 0 : tonic,
  scale: flag("--minor") ? "naturalMinor" : "major",
};

const STEPS = 8;
const BEAT = 1.05;
const HOLD = 0.92;

const history: number[] = [0];
const events: TimedEvent[] = [];
const lines: string[] = [];
let previousVoicing: number[] | undefined;
let time = 0;

for (let step = 0; step < STEPS; step++) {
  const degree = history[history.length - 1]!;
  const chord = diatonicChord(key, degree, {
    extension: step % 4 === 3 ? "seventh" : "triad",
  });
  const voicing = voiceLead(chord, previousVoicing);

  for (const pitch of voicing) {
    events.push({ time, type: "on", pitch, velocity: 96 });
    events.push({ time: time + HOLD, type: "off", pitch });
  }

  const suggestions = suggestNext(key, history);
  const top = suggestions
    .slice(0, 3)
    .map((s) => `${romanNumeral(s.chord)} ${(s.weight * 100).toFixed(0)}%`)
    .join("   ");

  lines.push(
    `  ${romanNumeral(chord).padEnd(7)} ${chordName(chord).padEnd(7)} ` +
      `[${voicing.join(" ")}]`.padEnd(18) + `next: ${top}`,
  );

  // Weighted random pick, so the engine improvises rather than repeating.
  let roll = Math.random() * suggestions.reduce((sum, s) => sum + s.weight, 0);
  let chosen = suggestions[0]!;
  for (const suggestion of suggestions) {
    roll -= suggestion.weight;
    if (roll <= 0) {
      chosen = suggestion;
      break;
    }
  }

  if (step === STEPS - 2) history.push(0);           // land home at the end
  else history.push(chosen.degree);

  previousVoicing = voicing;
  time += BEAT;
}

const DURATION = time + 1.0;

console.log(`\n  improvising in ${keyName(key)}\n`);
for (const line of lines) console.log(line);
console.log();

const wav = value("--wav");
if (wav) {
  const poly = new Polyphony(new SynthInstrument(DEFAULT_SYNTH, SAMPLE_RATE), 24);
  const mono = renderOffline(poly, events, DURATION);
  writeFileSync(wav, encodeWav(mono, { sampleRate: SAMPLE_RATE, channels: CHANNELS }));
  let peak = 0;
  for (const s of mono) peak = Math.max(peak, Math.abs(s));
  console.log(`  rendered ${DURATION.toFixed(1)}s to ${wav}  (peak ${peak.toFixed(3)})\n`);
} else {
  const poly = new Polyphony(new SynthInstrument(DEFAULT_SYNTH, SAMPLE_RATE), 24);
  const engine = new AudioEngine(poly);
  for (const ev of events) {
    setTimeout(() => {
      if (ev.type === "on") poly.noteOn(ev.pitch, ev.velocity ?? 100);
      else poly.noteOff(ev.pitch);
    }, ev.time * 1000);
  }
  setTimeout(() => {
    engine.stop();
    console.log(`  done. underruns: ${engine.underruns}\n`);
  }, DURATION * 1000);
  engine.start();
}
