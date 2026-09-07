import test from "node:test";
import assert from "node:assert/strict";
import { Polyphony } from "../src/audio/polyphony.ts";
import { DEFAULT_SYNTH, SynthInstrument } from "../src/audio/synth.ts";
import { SAMPLE_RATE } from "../src/audio/constants.ts";

const instrument = () => new SynthInstrument(DEFAULT_SYNTH, SAMPLE_RATE);
const block = () => new Float32Array(256);

test("starts with nothing sounding", () => {
  assert.equal(new Polyphony(instrument(), 4).activeCount, 0);
});

test("noteOn activates one voice per pitch", () => {
  const poly = new Polyphony(instrument(), 4);
  poly.noteOn(60);
  poly.noteOn(64);
  poly.noteOn(67);
  assert.equal(poly.activeCount, 3);
});

test("noteOff releases the voice holding that pitch", () => {
  const poly = new Polyphony(instrument(), 4);
  poly.noteOn(60);
  poly.noteOn(64);
  poly.noteOff(60);

  // Still active: release is a fade, not an instant stop.
  assert.equal(poly.activeCount, 2);

  // Render past the release time and it should free itself.
  const buf = block();
  for (let i = 0; i < 200; i++) {
    buf.fill(0);
    poly.render(buf, 0, 256);
  }
  assert.equal(poly.activeCount, 1);
});

test("noteOff for a pitch that is not sounding is harmless", () => {
  const poly = new Polyphony(instrument(), 4);
  poly.noteOn(60);
  poly.noteOff(72);
  assert.equal(poly.activeCount, 1);
});

test("steals the oldest voice when the pool is full", () => {
  const poly = new Polyphony(instrument(), 2);
  poly.noteOn(60);
  poly.noteOn(62);
  poly.noteOn(64);   // no free slot: 60 is the oldest and gets taken

  assert.equal(poly.activeCount, 2, "pool must not grow beyond its size");

  // 60 was stolen, so releasing it must not touch the voice now playing 64.
  poly.noteOff(60);
  assert.equal(poly.activeCount, 2);
});

test("retriggering a held pitch releases the old voice and starts a new one", () => {
  const poly = new Polyphony(instrument(), 8);
  poly.noteOn(60);
  poly.noteOn(60);
  // Both sound briefly -- the first is releasing while the second attacks.
  assert.equal(poly.activeCount, 2);
});

test("allNotesOff releases everything", () => {
  const poly = new Polyphony(instrument(), 4);
  poly.noteOn(60);
  poly.noteOn(64);
  poly.allNotesOff();

  const buf = block();
  for (let i = 0; i < 200; i++) {
    buf.fill(0);
    poly.render(buf, 0, 256);
  }
  assert.equal(poly.activeCount, 0);
});
