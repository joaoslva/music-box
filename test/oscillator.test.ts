import test from "node:test";
import assert from "node:assert/strict";
import { evaluate, WAVEFORMS } from "../src/audio/oscillator.ts";

test("every waveform stays within -1..1 across a full cycle", () => {
  for (const wave of WAVEFORMS) {
    for (let i = 0; i <= 1000; i++) {
      const v = evaluate(wave, i / 1000);
      assert.ok(v >= -1 && v <= 1, `${wave} produced ${v} at phase ${i / 1000}`);
    }
  }
});

test("sine peaks and crosses where expected", () => {
  assert.ok(Math.abs(evaluate("sine", 0)) < 1e-9);
  assert.ok(Math.abs(evaluate("sine", 0.25) - 1) < 1e-9);
  assert.ok(Math.abs(evaluate("sine", 0.75) + 1) < 1e-9);
});

test("triangle runs from -1 up through +1 and back", () => {
  assert.ok(Math.abs(evaluate("triangle", 0.5) + 1) < 1e-9);
  assert.ok(Math.abs(evaluate("triangle", 0) - 1) < 1e-9);
});
