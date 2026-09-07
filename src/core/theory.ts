/** A pitch class: 0 = C, 1 = C#, ... 11 = B. Octave-independent. */
export type PitchClass = number;

export const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
// Unicode ♭ rather than ASCII "b", matching the chord-quality suffixes
// (m7♭5) so names never mix the two conventions.
export const FLAT_NAMES = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"] as const;

export type ScaleName =
  | "major"
  | "naturalMinor"
  | "harmonicMinor"
  | "melodicMinor"
  | "dorian"
  | "phrygian"
  | "lydian"
  | "mixolydian"
  | "locrian";

/** Semitones above the tonic for each of the seven scale degrees. */
export const SCALES: Record<ScaleName, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  naturalMinor: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  melodicMinor: [0, 2, 3, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
};

/** Scales whose third degree is major. Used to pick harmonic conventions. */
const MAJOR_ISH: ReadonlySet<ScaleName> = new Set(["major", "lydian", "mixolydian"]);

export function isMajorIsh(scale: ScaleName): boolean {
  return MAJOR_ISH.has(scale);
}

/** The parallel mode: the same tonic, opposite colour. Used for borrowing. */
export function parallelScale(scale: ScaleName): ScaleName {
  return isMajorIsh(scale) ? "naturalMinor" : "major";
}

export interface Key {
  tonic: PitchClass;
  scale: ScaleName;
}

/** Wrap any integer into 0..11. */
export function normalize(pitchClass: number): PitchClass {
  return ((pitchClass % 12) + 12) % 12;
}

/**
 * Semitones above the tonic for a scale degree, where degree 0 is the tonic.
 *
 * Degrees outside 0..6 wrap into higher or lower octaves, which is what makes
 * stacking thirds (degree, +2, +4, +6) work without special-casing the top of
 * the scale.
 */
export function scaleInterval(scale: ScaleName, degree: number): number {
  const steps = SCALES[scale];
  const size = steps.length;
  const octave = Math.floor(degree / size);
  const index = ((degree % size) + size) % size;
  return steps[index]! + octave * 12;
}

/** All seven pitch classes of a key, starting from the tonic. */
export function scalePitchClasses(key: Key): PitchClass[] {
  return SCALES[key.scale].map((step) => normalize(key.tonic + step));
}

/**
 * Name a pitch class. Flats are preferred in flat keys, which is why the
 * caller passes the preference rather than us guessing from the note alone.
 */
export function noteName(pitchClass: number, preferFlats = false): string {
  const table = preferFlats ? FLAT_NAMES : SHARP_NAMES;
  return table[normalize(pitchClass)]!;
}

/** Keys conventionally written with flats. */
const FLAT_TONICS: ReadonlySet<PitchClass> = new Set([1, 3, 5, 8, 10]);

export function keyPrefersFlats(key: Key): boolean {
  return FLAT_TONICS.has(normalize(key.tonic));
}

export function keyName(key: Key): string {
  const tonic = noteName(key.tonic, keyPrefersFlats(key));
  const readable: Record<ScaleName, string> = {
    major: "major",
    naturalMinor: "minor",
    harmonicMinor: "harmonic minor",
    melodicMinor: "melodic minor",
    dorian: "dorian",
    phrygian: "phrygian",
    lydian: "lydian",
    mixolydian: "mixolydian",
    locrian: "locrian",
  };
  return `${tonic} ${readable[key.scale]}`;
}
