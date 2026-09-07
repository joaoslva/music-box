import test from "node:test";
import assert from "node:assert/strict";
import {
  borrowedChord, chordName, diatonicChord, harmonicFunction,
  romanNumeral, secondaryDominant,
} from "../src/core/chord.ts";
import type { Key } from "../src/core/theory.ts";

const C_MAJOR: Key = { tonic: 0, scale: "major" };
const A_MINOR: Key = { tonic: 9, scale: "naturalMinor" };
const D_DORIAN: Key = { tonic: 2, scale: "dorian" };

const namesFor = (key: Key, opts = {}) =>
  [0, 1, 2, 3, 4, 5, 6].map((d) => chordName(diatonicChord(key, d, opts)));

const numeralsFor = (key: Key, opts = {}) =>
  [0, 1, 2, 3, 4, 5, 6].map((d) => romanNumeral(diatonicChord(key, d, opts)));

test("C major triads are the seven chords every beginner learns", () => {
  assert.deepEqual(namesFor(C_MAJOR), ["C", "Dm", "Em", "F", "G", "Am", "B°"]);
});

test("C major roman numerals", () => {
  assert.deepEqual(numeralsFor(C_MAJOR), ["I", "ii", "iii", "IV", "V", "vi", "vii°"]);
});

test("C major sevenths", () => {
  assert.deepEqual(
    namesFor(C_MAJOR, { extension: "seventh" }),
    ["Cmaj7", "Dm7", "Em7", "Fmaj7", "G7", "Am7", "Bm7♭5"],
  );
});

test("A natural minor is the same notes starting elsewhere", () => {
  assert.deepEqual(namesFor(A_MINOR), ["Am", "B°", "C", "Dm", "Em", "F", "G"]);
});

test("modes derive their own qualities without special-casing", () => {
  // D dorian: the major IV chord is what makes dorian sound unlike minor.
  assert.deepEqual(namesFor(D_DORIAN), ["Dm", "Em", "F", "G", "Am", "B°", "C"]);
  assert.equal(romanNumeral(diatonicChord(D_DORIAN, 3)), "IV");
});

test("suspensions replace the third", () => {
  assert.equal(chordName(diatonicChord(C_MAJOR, 0, { suspension: "sus4" })), "Csus4");
  assert.equal(chordName(diatonicChord(C_MAJOR, 0, { suspension: "sus2" })), "Csus2");
});

test("ninths stack two more thirds", () => {
  const chord = diatonicChord(C_MAJOR, 4, { extension: "ninth" });
  assert.equal(chordName(chord), "G9");
  assert.deepEqual(chord.intervals, [0, 4, 7, 10, 14]);
});

test("borrowing from the parallel minor gives ♭VII and iv", () => {
  const flatSeven = borrowedChord(C_MAJOR, 6);
  assert.equal(chordName(flatSeven), "B♭");
  assert.equal(romanNumeral(flatSeven), "♭VII");

  const minorFour = borrowedChord(C_MAJOR, 3);
  assert.equal(chordName(minorFour), "Fm");
  assert.equal(romanNumeral(minorFour), "iv");

  // Flattened roots take flat spellings even though C major is a sharp key.
  assert.equal(chordName(borrowedChord(C_MAJOR, 5)), "A♭");
  assert.equal(romanNumeral(borrowedChord(C_MAJOR, 5)), "♭VI");
  assert.equal(chordName(borrowedChord(C_MAJOR, 2)), "E♭");
  assert.equal(romanNumeral(borrowedChord(C_MAJOR, 2)), "♭III");
});

test("secondary dominants tonicise their target", () => {
  const vOfV = secondaryDominant(C_MAJOR, 4);
  assert.equal(chordName(vOfV), "D7");
  assert.equal(romanNumeral(vOfV), "V/V");

  const vOfVi = secondaryDominant(C_MAJOR, 5);
  assert.equal(chordName(vOfVi), "E7");
  assert.equal(romanNumeral(vOfVi), "V/vi");
});

test("harmonic function follows the classical T-S-D grouping", () => {
  const fns = [0, 1, 2, 3, 4, 5, 6].map((d) => harmonicFunction(d, C_MAJOR));
  assert.deepEqual(fns, [
    "tonic", "subdominant", "tonic", "subdominant", "dominant", "tonic", "dominant",
  ]);
});

test("every key produces well-formed triads", () => {
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const scale of ["major", "naturalMinor", "dorian", "mixolydian"] as const) {
      for (let degree = 0; degree < 7; degree++) {
        const chord = diatonicChord({ tonic, scale }, degree);
        assert.equal(chord.intervals.length, 3);
        assert.equal(chord.intervals[0], 0);
        assert.notEqual(chord.quality, "unknown", `${tonic} ${scale} degree ${degree}`);
      }
    }
  }
});
