/**
 * Milestone 1a verification.
 *
 *   node scripts/demo-1a.ts            play through the speakers
 *   node scripts/demo-1a.ts --wav out.wav   render to a file instead
 *
 * Both paths drive the SAME event list through the SAME engine, so the offline
 * render is a faithful preview of what realtime playback produces.
 *
 * Listen for: clean attacks with no click, notes that release smoothly rather
 * than cutting off, and a chord that holds steady without distorting.
 */
import { writeFileSync } from "node:fs";
import { AudioEngine } from "../src/audio/engine.ts";
import { SAMPLE_RATE, CHANNELS } from "../src/audio/constants.ts";
import { renderOffline, type TimedEvent } from "../src/audio/offline.ts";
import { Polyphony } from "../src/audio/polyphony.ts";
import { pitchName } from "../src/audio/pitch.ts";
import { DEFAULT_SYNTH, SynthInstrument } from "../src/audio/synth.ts";
import { encodeWav } from "../src/audio/wav.ts";

const SCALE = [60, 62, 64, 65, 67, 69, 71, 72];
const CHORD = [60, 64, 67, 72];
const STEP = 0.28;

const events: TimedEvent[] = [];
let t = 0;

for (const pitch of SCALE) {
  events.push({ time: t, type: "on", pitch, velocity: 90 });
  events.push({ time: t + STEP * 0.85, type: "off", pitch });
  t += STEP;
}

t += 0.3;
const chordAt = t;
for (const pitch of CHORD) events.push({ time: t, type: "on", pitch, velocity: 105 });
for (const pitch of CHORD) events.push({ time: t + 1.6, type: "off", pitch });

const DURATION = t + 1.6 + 0.8;

const wavIndex = process.argv.indexOf("--wav");

if (wavIndex !== -1) {
  const path = process.argv[wavIndex + 1] ?? "demo.wav";
  const poly = new Polyphony(new SynthInstrument(DEFAULT_SYNTH, SAMPLE_RATE), 16);

  const started = performance.now();
  const mono = renderOffline(poly, events, DURATION);
  const elapsed = (performance.now() - started) / 1000;

  writeFileSync(path, encodeWav(mono, { sampleRate: SAMPLE_RATE, channels: CHANNELS }));

  let peak = 0;
  for (const s of mono) peak = Math.max(peak, Math.abs(s));

  console.log(`rendered ${DURATION.toFixed(1)}s to ${path}`);
  console.log(`  took   ${elapsed.toFixed(3)}s  (${(DURATION / elapsed).toFixed(0)}x realtime)`);
  console.log(`  peak   ${peak.toFixed(3)}`);
} else {
  const poly = new Polyphony(new SynthInstrument(DEFAULT_SYNTH, SAMPLE_RATE), 16);
  const engine = new AudioEngine(poly);

  console.log("playing a C major scale, then a held chord...\n");

  for (const ev of events) {
    setTimeout(() => {
      if (ev.type === "on") {
        poly.noteOn(ev.pitch, ev.velocity ?? 100);
        const label = ev.time === chordAt ? "chord" : "note ";
        process.stdout.write(`  ${ev.time.toFixed(2)}s  ${label} ${pitchName(ev.pitch)}\n`);
      } else {
        poly.noteOff(ev.pitch);
      }
    }, ev.time * 1000);
  }

  setTimeout(() => {
    engine.stop();
    console.log(`\ndone. underruns: ${engine.underruns}`);
    if (engine.underruns > 0) {
      console.log("(underruns mean the buffer ran dry -- raise TARGET_BUFFER_SEC)");
    }
  }, DURATION * 1000);

  engine.start();
}
