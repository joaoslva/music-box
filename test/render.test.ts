import test from "node:test";
import assert from "node:assert/strict";
import { SAMPLE_RATE } from "../src/audio/constants.ts";
import { renderOffline } from "../src/audio/offline.ts";
import { Polyphony } from "../src/audio/polyphony.ts";
import { DEFAULT_SYNTH, SynthInstrument } from "../src/audio/synth.ts";

const poly = () => new Polyphony(new SynthInstrument(DEFAULT_SYNTH, SAMPLE_RATE), 16);

const peak = (buf: Float32Array, from: number, to: number): number => {
  let max = 0;
  for (let i = from; i < to; i++) max = Math.max(max, Math.abs(buf[i]));
  return max;
};

test("silent before the first note, audible after", () => {
  const out = renderOffline(poly(), [{ time: 0.1, type: "on", pitch: 60 }], 0.5);

  assert.equal(peak(out, 0, 0.1 * SAMPLE_RATE), 0, "must be exactly silent before noteOn");
  assert.ok(peak(out, 0.15 * SAMPLE_RATE, 0.4 * SAMPLE_RATE) > 0.01, "note should be audible");
});

test("fades toward silence after noteOff", () => {
  const out = renderOffline(
    poly(),
    [
      { time: 0.0, type: "on", pitch: 60 },
      { time: 0.3, type: "off", pitch: 60 },
    ],
    1.0,
  );

  const held = peak(out, 0.2 * SAMPLE_RATE, 0.3 * SAMPLE_RATE);
  const after = peak(out, 0.7 * SAMPLE_RATE, 1.0 * SAMPLE_RATE);

  assert.ok(held > 0.01, "note should sound while held");
  assert.ok(after < held / 100, `release did not fade: held ${held}, after ${after}`);
});

test("no clicks: the waveform stays continuous through attack and release", () => {
  // A click IS a discontinuity. With a triangle wave at these pitches the
  // largest legitimate step between samples is well under 0.02; an abrupt
  // envelope cut would jump by an order of magnitude more.
  const out = renderOffline(
    poly(),
    [
      { time: 0.0, type: "on", pitch: 60 },
      { time: 0.1, type: "on", pitch: 64 },
      { time: 0.2, type: "on", pitch: 67 },
      { time: 0.4, type: "off", pitch: 60 },
      { time: 0.4, type: "off", pitch: 64 },
      { time: 0.4, type: "off", pitch: 67 },
    ],
    1.0,
  );

  let worst = 0;
  let worstAt = 0;
  for (let i = 1; i < out.length; i++) {
    const step = Math.abs(out[i] - out[i - 1]);
    if (step > worst) {
      worst = step;
      worstAt = i;
    }
  }

  assert.ok(
    worst < 0.05,
    `discontinuity of ${worst.toFixed(4)} at sample ${worstAt} (${(worstAt / SAMPLE_RATE).toFixed(3)}s)`,
  );
});

test("velocity scales amplitude", () => {
  const soft = renderOffline(poly(), [{ time: 0, type: "on", pitch: 60, velocity: 32 }], 0.3);
  const loud = renderOffline(poly(), [{ time: 0, type: "on", pitch: 60, velocity: 127 }], 0.3);

  const softPeak = peak(soft, 0, soft.length);
  const loudPeak = peak(loud, 0, loud.length);
  assert.ok(loudPeak > softPeak * 2, `soft ${softPeak}, loud ${loudPeak}`);
});

test("rendering is deterministic", () => {
  const events = [{ time: 0, type: "on" as const, pitch: 60 }];
  const a = renderOffline(poly(), events, 0.2);
  const b = renderOffline(poly(), events, 0.2);
  assert.deepEqual(Array.from(a), Array.from(b));
});

test("a full chord stays within the soft-clip range", () => {
  const events = [48, 55, 60, 64, 67, 72].map((pitch) => ({
    time: 0,
    type: "on" as const,
    pitch,
    velocity: 127,
  }));
  const out = renderOffline(poly(), events, 0.5);
  assert.ok(peak(out, 0, out.length) < 1.5, "pre-clip bus should stay sane with 6 loud notes");
});
