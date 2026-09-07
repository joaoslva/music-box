import type { Chord } from "./chord.ts";

export interface VoicingOptions {
  /** Octave for the root. 4 puts the root near middle C (MIDI 60). */
  octave?: number;
  /** How many of the lowest notes to lift by an octave. */
  inversion?: number;
}

/** MIDI pitch of a pitch class in a given octave. C4 = 60. */
export function toMidi(pitchClass: number, octave: number): number {
  return pitchClass + 12 * (octave + 1);
}

/** Realise a chord as ascending MIDI pitches. */
export function voiceChord(chord: Chord, opts: VoicingOptions = {}): number[] {
  const octave = opts.octave ?? 4;
  const inversion = opts.inversion ?? 0;
  const base = toMidi(chord.root, octave);

  const pitches = chord.intervals.map((i) => base + i);
  for (let n = 0; n < inversion; n++) {
    const lowest = pitches.shift();
    if (lowest === undefined) break;
    pitches.push(lowest + 12);
  }
  return pitches;
}

const LOWEST_USEFUL = 36;
const HIGHEST_USEFUL = 96;

/**
 * How awkward a voicing is, given what was playing before.
 *
 * Two competing pulls: stay close to the previous chord (smooth voice leading)
 * and stay near the target register (do not drift up the keyboard over a long
 * progression).
 */
function voicingCost(
  candidate: readonly number[],
  previous: readonly number[] | undefined,
  center: number,
): number {
  const centroid = candidate.reduce((sum, p) => sum + p, 0) / candidate.length;
  let cost = Math.abs(centroid - center) * 0.8;

  if (previous && previous.length > 0) {
    // Distance from each new note to the nearest note already sounding.
    for (const pitch of candidate) {
      let nearest = Infinity;
      for (const prev of previous) nearest = Math.min(nearest, Math.abs(pitch - prev));
      cost += nearest;
    }
  }

  const low = candidate[0] ?? 0;
  const high = candidate[candidate.length - 1] ?? 0;
  if (low < LOWEST_USEFUL || high > HIGHEST_USEFUL) cost += 100;

  return cost;
}

/**
 * Pick the inversion and octave that moves least from the previous chord.
 *
 * This is what makes an automatic chord player sound musical rather than
 * mechanical. Root-position chords in a fixed octave leap around; choosing the
 * nearest inversion keeps common tones in place and moves the rest by a step
 * or two, which is what a keyboard player does without thinking.
 */
export function voiceLead(
  chord: Chord,
  previous: readonly number[] | undefined,
  center = 60,
): number[] {
  let best: number[] | undefined;
  let bestCost = Infinity;

  for (let octave = 2; octave <= 6; octave++) {
    for (let inversion = 0; inversion < chord.intervals.length; inversion++) {
      const candidate = voiceChord(chord, { octave, inversion });
      const cost = voicingCost(candidate, previous, center);
      if (cost < bestCost) {
        bestCost = cost;
        best = candidate;
      }
    }
  }

  return best ?? voiceChord(chord, { octave: 4 });
}

/** Total semitone movement between two voicings, for tests and display. */
export function voiceMovement(from: readonly number[], to: readonly number[]): number {
  let total = 0;
  for (const pitch of to) {
    let nearest = Infinity;
    for (const prev of from) nearest = Math.min(nearest, Math.abs(pitch - prev));
    total += nearest;
  }
  return total;
}
