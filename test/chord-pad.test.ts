import test from "node:test";
import assert from "node:assert/strict";
import { ChordPad } from "../src/app/chord-pad.ts";
import { chordName, romanNumeral } from "../src/core/chord.ts";

const pad = () => new ChordPad({ key: { tonic: 0, scale: "major" }, octave: 4 });

test("pressing a degree sounds every note of the chord", () => {
  const p = pad();
  const events = p.press(0);
  assert.equal(events.length, 3);
  assert.ok(events.every((e) => e.type === "noteOn"));
});

test("releasing sounds off exactly the pitches that were pressed", () => {
  const p = pad();
  const on = p.press(4).map((e) => e.pitch);
  const off = p.release(4).map((e) => e.pitch);
  assert.deepEqual(off, on);
});

test("releasing something not held is harmless", () => {
  assert.deepEqual(pad().release(3), []);
});

test("pressing the same degree twice does not double-trigger", () => {
  const p = pad();
  p.press(0);
  assert.deepEqual(p.press(0), [], "second press should be ignored while held");
});

test("several degrees can sound at once, released independently", () => {
  const p = pad();
  p.press(0);
  p.press(3);
  assert.equal(p.state.sounding.length, 2);

  p.release(0);
  assert.equal(p.state.sounding.length, 1);
  assert.equal(p.state.sounding[0]!.degree, 3);
});

test("modifiers select borrowed chords and secondary dominants", () => {
  const p = pad();
  assert.equal(chordName(p.chordFor(6, "diatonic")), "B°");
  assert.equal(chordName(p.chordFor(6, "borrowed")), "B♭");
  assert.equal(romanNumeral(p.chordFor(4, "secondary")), "V/V");
});

test("extension and suspension cycle and affect the next chord", () => {
  const p = pad();
  assert.equal(chordName(p.chordFor(0)), "C");

  assert.equal(p.cycleExtension(), "seventh");
  assert.equal(chordName(p.chordFor(0)), "Cmaj7");
  assert.equal(p.cycleExtension(), "ninth");
  assert.equal(p.cycleExtension(), "triad", "cycles back around");

  assert.equal(p.cycleSuspension(), "sus2");
  assert.equal(chordName(p.chordFor(0)), "Csus2");
});

test("history drives suggestions and is capped", () => {
  const p = new ChordPad({ historyLimit: 3 });
  for (const degree of [0, 3, 4, 5, 1]) {
    p.press(degree);
    p.release(degree);
  }
  assert.equal(p.state.history.length, 3);
  assert.deepEqual([...p.state.history], [4, 5, 1]);
  assert.ok(p.state.suggestions.length > 0);
});

test("transposing keeps degrees valid — they are relative to the key", () => {
  const p = pad();
  assert.equal(chordName(p.chordFor(0)), "C");
  p.transpose(2);
  assert.equal(chordName(p.chordFor(0)), "D");
  p.transpose(-14);
  assert.equal(chordName(p.chordFor(0)), "C", "-14 from D wraps a full octave back to C");
  p.transpose(-1);
  assert.equal(chordName(p.chordFor(0)), "B", "negative wrap below zero");
});

test("toggling scale swaps to the parallel mode", () => {
  const p = pad();
  assert.equal(romanNumeral(p.chordFor(0)), "I");
  p.toggleScale();
  assert.equal(romanNumeral(p.chordFor(0)), "i");
  assert.equal(chordName(p.chordFor(0)), "Cm");
});

test("voice leading keeps successive chords close together", () => {
  const led = pad();
  const plain = pad();
  plain.toggleVoiceLeading();

  const progression = [0, 3, 4, 5, 1, 4, 0];
  let ledSpread = 0;
  let plainSpread = 0;
  let ledPrev: number[] | undefined;
  let plainPrev: number[] | undefined;

  for (const degree of progression) {
    const a = led.press(degree).map((e) => e.pitch);
    const b = plain.press(degree).map((e) => e.pitch);
    if (ledPrev) ledSpread += Math.abs((a[0] ?? 0) - (ledPrev[0] ?? 0));
    if (plainPrev) plainSpread += Math.abs((b[0] ?? 0) - (plainPrev[0] ?? 0));
    ledPrev = a;
    plainPrev = b;
    led.release(degree);
    plain.release(degree);
  }

  assert.ok(ledSpread < plainSpread, `voice-led ${ledSpread} vs plain ${plainSpread}`);
});

test("releaseAll silences everything", () => {
  const p = pad();
  p.press(0);
  p.press(4);
  const off = p.releaseAll();
  assert.ok(off.length >= 6);
  assert.ok(off.every((e) => e.type === "noteOff"));
  assert.equal(p.state.sounding.length, 0);
});

test("octave shifting clamps to a usable range", () => {
  const p = pad();
  for (let i = 0; i < 10; i++) p.shiftOctave(1);
  assert.equal(p.state.octave, 7);
  for (let i = 0; i < 20; i++) p.shiftOctave(-1);
  assert.equal(p.state.octave, 1);
});
