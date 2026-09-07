import test from "node:test";
import assert from "node:assert/strict";
import { diatonicChord } from "../src/core/chord.ts";
import { toMidi, voiceChord, voiceLead, voiceMovement } from "../src/core/voicing.ts";
import type { Key } from "../src/core/theory.ts";

const C_MAJOR: Key = { tonic: 0, scale: "major" };

test("middle C is MIDI 60", () => {
  assert.equal(toMidi(0, 4), 60);
  assert.equal(toMidi(9, 4), 69);   // A4 = 440Hz
});

test("root position stacks the chord upward from the root", () => {
  assert.deepEqual(voiceChord(diatonicChord(C_MAJOR, 0), { octave: 4 }), [60, 64, 67]);
});

test("inversions lift the lowest note by an octave", () => {
  const chord = diatonicChord(C_MAJOR, 0);
  assert.deepEqual(voiceChord(chord, { octave: 4, inversion: 1 }), [64, 67, 72]);
  assert.deepEqual(voiceChord(chord, { octave: 4, inversion: 2 }), [67, 72, 76]);
});

test("voice leading moves less than jumping between root positions", () => {
  const key = C_MAJOR;
  const progression = [0, 3, 4, 5, 1, 4, 0];

  let ledTotal = 0;
  let rootTotal = 0;
  let led = voiceLead(diatonicChord(key, progression[0]!), undefined);
  let root = voiceChord(diatonicChord(key, progression[0]!), { octave: 4 });

  for (const degree of progression.slice(1)) {
    const chord = diatonicChord(key, degree);
    const nextLed = voiceLead(chord, led);
    const nextRoot = voiceChord(chord, { octave: 4 });

    ledTotal += voiceMovement(led, nextLed);
    rootTotal += voiceMovement(root, nextRoot);
    led = nextLed;
    root = nextRoot;
  }

  assert.ok(
    ledTotal < rootTotal,
    `voice leading (${ledTotal}) should move less than root position (${rootTotal})`,
  );
});

test("voice leading keeps chords in a usable register over a long progression", () => {
  const key = C_MAJOR;
  let voicing = voiceLead(diatonicChord(key, 0), undefined);

  // Twenty chords is enough for a naive "nearest inversion" rule to drift off
  // the top of the keyboard. The register pull is what prevents that.
  for (let i = 0; i < 20; i++) {
    voicing = voiceLead(diatonicChord(key, [0, 4, 5, 3][i % 4]!), voicing);
    for (const pitch of voicing) {
      assert.ok(pitch >= 36 && pitch <= 96, `pitch ${pitch} drifted out of range at step ${i}`);
    }
  }
});

test("every chord voices to as many pitches as it has intervals", () => {
  for (let degree = 0; degree < 7; degree++) {
    for (const extension of ["triad", "seventh", "ninth"] as const) {
      const chord = diatonicChord(C_MAJOR, degree, { extension });
      assert.equal(voiceLead(chord, undefined).length, chord.intervals.length);
    }
  }
});
