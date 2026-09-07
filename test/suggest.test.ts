import test from "node:test";
import assert from "node:assert/strict";
import { romanNumeral } from "../src/core/chord.ts";
import { suggestNext } from "../src/core/suggest.ts";
import type { Key } from "../src/core/theory.ts";

const C_MAJOR: Key = { tonic: 0, scale: "major" };
const A_MINOR: Key = { tonic: 9, scale: "naturalMinor" };

const degrees = (key: Key, history: number[], opts = {}) =>
  suggestNext(key, history, { includeSecondary: false, ...opts }).map((s) => s.degree);

test("V wants to resolve to I above all else", () => {
  assert.equal(degrees(C_MAJOR, [4])[0], 0);
});

test("ii most wants to go to V", () => {
  assert.equal(degrees(C_MAJOR, [1])[0], 4);
});

test("vii° leans hard on the tonic", () => {
  assert.equal(degrees(C_MAJOR, [6])[0], 0);
});

test("never suggests repeating the chord you are already on", () => {
  for (let degree = 0; degree < 7; degree++) {
    assert.ok(!degrees(C_MAJOR, [degree]).includes(degree), `repeated degree ${degree}`);
  }
});

test("weights are normalised and ordered", () => {
  const suggestions = suggestNext(C_MAJOR, [0]);
  const total = suggestions.reduce((sum, s) => sum + s.weight, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `weights summed to ${total}`);

  for (let i = 1; i < suggestions.length; i++) {
    assert.ok(suggestions[i - 1]!.weight >= suggestions[i]!.weight, "not sorted by weight");
  }
});

test("recognising a progression pulls its next chord to the front", () => {
  // I–V–vi is the start of the four-chord loop; IV should now lead.
  const withContext = degrees(C_MAJOR, [0, 4, 5]);
  assert.equal(withContext[0], 3, "expected IV to lead after I–V–vi");

  const reason = suggestNext(C_MAJOR, [0, 4, 5], { includeSecondary: false })[0]!.reason;
  assert.match(reason, /continues/, `reason was "${reason}"`);
});

test("ii–V–I is recognised as a cadence", () => {
  const suggestions = suggestNext(C_MAJOR, [1, 4], { includeSecondary: false });
  assert.equal(suggestions[0]!.degree, 0);
});

test("every suggestion explains itself", () => {
  for (const history of [[], [0], [4], [0, 4, 5], [1, 4]]) {
    for (const s of suggestNext(C_MAJOR, history)) {
      assert.ok(s.reason.length > 0, "empty reason");
      assert.ok(s.weight > 0, "non-positive weight");
    }
  }
});

test("an empty history offers an even spread rather than nothing", () => {
  const suggestions = suggestNext(C_MAJOR, [], { includeSecondary: false });
  assert.equal(suggestions.length, 5);
  assert.match(suggestions[0]!.reason, /start/);
});

test("secondary dominants are offered but rank below the plain chord", () => {
  const withSecondary = suggestNext(C_MAJOR, [0], { includeSecondary: true });
  const secondaries = withSecondary.filter((s) => s.chord.origin === "secondaryDominant");
  assert.ok(secondaries.length > 0, "expected at least one V/x");
  assert.equal(withSecondary[0]!.chord.origin, "diatonic", "a V/x should not lead");
});

test("minor keys use their own tendencies", () => {
  const suggestions = suggestNext(A_MINOR, [4], { includeSecondary: false });
  assert.equal(suggestions[0]!.degree, 0, "V should still resolve to i");
  assert.equal(romanNumeral(suggestions[0]!.chord), "i");
});
