import test from "node:test";
import assert from "node:assert/strict";
import { PianoKeymap } from "../src/input/keymap.ts";
import { NO_MODIFIERS, type KeyEvent } from "../src/input/types.ts";

const press = (char: string): KeyEvent => ({
  key: char.codePointAt(0)!, modifiers: NO_MODIFIERS, type: "press",
});
const release = (char: string): KeyEvent => ({ ...press(char), type: "release" });
const repeat = (char: string): KeyEvent => ({ ...press(char), type: "repeat" });

test("the home row is a piano octave starting at middle C", () => {
  const map = new PianoKeymap({ baseOctave: 4 });
  const white = ["z", "x", "c", "v", "b", "n", "m"].map((c) => map.translate(press(c))!.pitch);
  assert.deepEqual(white, [60, 62, 64, 65, 67, 69, 71]);   // C D E F G A B
});

test("the row above gives the black keys", () => {
  const map = new PianoKeymap({ baseOctave: 4 });
  const black = ["s", "d", "g", "h", "j"].map((c) => map.translate(press(c))!.pitch);
  assert.deepEqual(black, [61, 63, 66, 68, 70]);           // C# D# F# G# A#
});

test("the upper rows continue into the next octave", () => {
  const map = new PianoKeymap({ baseOctave: 4 });
  assert.equal(map.translate(press("q"))!.pitch, 72);
  assert.equal(map.translate(press("u"))!.pitch, 83);
});

test("press becomes noteOn and release becomes noteOff", () => {
  const map = new PianoKeymap();
  assert.equal(map.translate(press("z"))!.type, "noteOn");
  assert.equal(map.translate(release("z"))!.type, "noteOff");
});

test("autorepeat is ignored so held notes do not machine-gun", () => {
  // The whole point of tracking releases is sustained notes. If autorepeat
  // retriggered the envelope, holding a key would stutter instead of sustain.
  const map = new PianoKeymap();
  assert.equal(map.translate(repeat("z")), undefined);
});

test("octave keys shift the whole layout", () => {
  const map = new PianoKeymap({ baseOctave: 4 });
  assert.equal(map.translate(press("z"))!.pitch, 60);

  assert.equal(map.translate(press(".")), undefined, "octave keys emit no note");
  assert.equal(map.baseOctave, 5);
  assert.equal(map.translate(press("z"))!.pitch, 72);

  map.translate(press(","));
  map.translate(press(","));
  assert.equal(map.baseOctave, 3);
  assert.equal(map.translate(press("z"))!.pitch, 48);
});

test("octave shifting clamps instead of running off the keyboard", () => {
  const map = new PianoKeymap({ baseOctave: 0 });
  for (let i = 0; i < 5; i++) map.translate(press(","));
  assert.equal(map.baseOctave, 0);

  const high = new PianoKeymap({ baseOctave: 8 });
  for (let i = 0; i < 5; i++) high.translate(press("."));
  assert.equal(high.baseOctave, 8);
});

test("keys outside the layout produce nothing", () => {
  const map = new PianoKeymap();
  for (const char of ["k", "l", "p", "1", "9", " "]) {
    assert.equal(map.translate(press(char)), undefined, `"${char}" should not be a note`);
  }
});

test("a held chord maps to independent pitches", () => {
  const map = new PianoKeymap({ baseOctave: 4 });
  const chord = ["z", "c", "b"].map((c) => map.translate(press(c))!.pitch);
  assert.deepEqual(chord, [60, 64, 67]);   // C major
});
