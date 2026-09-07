import test from "node:test";
import assert from "node:assert/strict";
import { ADSR } from "../src/audio/envelope.ts";

const SR = 48_000;
const params = { attack: 0.01, decay: 0.05, sustain: 0.5, release: 0.02 };

test("starts idle and silent", () => {
  const env = new ADSR(params, SR);
  assert.equal(env.stage, "idle");
  assert.equal(env.process(), 0);
  assert.equal(env.active, false);
});

test("attack reaches full level in the attack time", () => {
  const env = new ADSR(params, SR);
  env.noteOn();

  let steps = 0;
  while (env.stage === "attack" && steps < SR) {
    env.process();
    steps++;
  }

  // Summing 1/n a total of n times lands a float epsilon short of 1.0, so the
  // stage flips one sample late. Inaudible; assert the real contract instead
  // of an exact sample count.
  const expected = params.attack * SR;
  assert.ok(
    Math.abs(steps - expected) <= 2,
    `attack took ${steps} samples, expected ~${expected}`,
  );
  assert.equal(env.stage, "decay");
});

test("decay settles to the sustain level and holds", () => {
  const env = new ADSR(params, SR);
  env.noteOn();
  let value = 0;
  for (let i = 0; i < SR; i++) value = env.process();   // one full second
  assert.equal(env.stage, "sustain");
  assert.ok(Math.abs(value - params.sustain) < 1e-3, `got ${value}`);
});

test("release fades to silence and the voice goes inactive", () => {
  const env = new ADSR(params, SR);
  env.noteOn();
  for (let i = 0; i < SR; i++) env.process();
  env.noteOff();
  assert.equal(env.stage, "release");

  let steps = 0;
  while (env.active && steps < SR) {
    env.process();
    steps++;
  }
  assert.equal(env.active, false, "release never completed");
  assert.ok(steps < SR, "release took longer than a second");
});

test("releasing mid-attack glides down instead of jumping", () => {
  // The click-prone case: key released before the attack finished.
  const slow = new ADSR({ ...params, attack: 1 }, SR);
  slow.noteOn();
  let value = 0;
  for (let i = 0; i < 100; i++) value = slow.process();

  slow.noteOff();
  const afterRelease = slow.process();

  assert.ok(afterRelease < value, "release should descend");
  assert.ok(
    value - afterRelease < 0.01,
    `jumped by ${value - afterRelease}; should ease from the current level`,
  );
});

test("zero sustain ends the note instead of hanging silently", () => {
  // A percussive patch: decay IS the whole note.
  const pluck = new ADSR({ ...params, sustain: 0 }, SR);
  pluck.noteOn();
  for (let i = 0; i < SR; i++) pluck.process();
  assert.equal(pluck.stage, "idle");
  assert.equal(pluck.active, false);
});
