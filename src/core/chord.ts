import {
  isMajorIsh,
  keyPrefersFlats,
  noteName,
  normalize,
  parallelScale,
  scaleInterval,
  type Key,
  type PitchClass,
} from "./theory.ts";

export type ChordQuality =
  | "major" | "minor" | "diminished" | "augmented"
  | "sus2" | "sus4"
  | "major7" | "dominant7" | "minor7" | "halfDiminished7" | "diminished7" | "minorMajor7"
  | "major9" | "dominant9" | "minor9"
  | "unknown";

export type Extension = "triad" | "seventh" | "ninth";
export type Suspension = "none" | "sus2" | "sus4";

export type ChordOrigin = "diatonic" | "borrowed" | "secondaryDominant";

export interface ChordOptions {
  extension?: Extension;
  suspension?: Suspension;
}

export interface Chord {
  /** Root pitch class, 0-11. */
  root: PitchClass;
  /** Semitones above the root, ascending, always starting at 0. */
  intervals: readonly number[];
  quality: ChordQuality;
  /** Scale degree 0-6 this was built on, within `key`. */
  degree: number;
  key: Key;
  origin: ChordOrigin;
  /** For secondary dominants: the degree being tonicised. */
  target?: number;
}

const QUALITY_BY_INTERVALS = new Map<string, ChordQuality>([
  ["0,4,7", "major"],
  ["0,3,7", "minor"],
  ["0,3,6", "diminished"],
  ["0,4,8", "augmented"],
  ["0,2,7", "sus2"],
  ["0,5,7", "sus4"],
  ["0,4,7,11", "major7"],
  ["0,4,7,10", "dominant7"],
  ["0,3,7,10", "minor7"],
  ["0,3,6,10", "halfDiminished7"],
  ["0,3,6,9", "diminished7"],
  ["0,3,7,11", "minorMajor7"],
  ["0,4,7,11,14", "major9"],
  ["0,4,7,10,14", "dominant9"],
  ["0,3,7,10,14", "minor9"],
]);

export function identifyQuality(intervals: readonly number[]): ChordQuality {
  return QUALITY_BY_INTERVALS.get(intervals.join(",")) ?? "unknown";
}

/**
 * Build a chord by stacking thirds *within the scale*.
 *
 * Taking degrees d, d+2, d+4 (and d+6, d+8) means the quality is derived from
 * the scale rather than hardcoded per degree. That is why this works unchanged
 * for dorian or phrygian, where the familiar "I ii iii IV V vi vii" pattern of
 * qualities does not hold.
 */
export function diatonicChord(key: Key, degree: number, opts: ChordOptions = {}): Chord {
  const extension = opts.extension ?? "triad";
  const suspension = opts.suspension ?? "none";

  const rootInterval = scaleInterval(key.scale, degree);
  const relative = (step: number) => scaleInterval(key.scale, degree + step) - rootInterval;

  const third = suspension === "sus2" ? 2 : suspension === "sus4" ? 5 : relative(2);
  const intervals: number[] = [0, third, relative(4)];

  if (extension === "seventh" || extension === "ninth") intervals.push(relative(6));
  if (extension === "ninth") intervals.push(relative(8));

  return {
    root: normalize(key.tonic + rootInterval),
    intervals,
    quality: identifyQuality(intervals),
    degree: ((degree % 7) + 7) % 7,
    key,
    origin: "diatonic",
  };
}

/**
 * The same degree taken from the parallel mode -- major borrowing from minor
 * or the reverse. This is modal interchange, and it is where ♭VII and iv in a
 * major key come from.
 */
export function borrowedChord(key: Key, degree: number, opts: ChordOptions = {}): Chord {
  const parallel: Key = { tonic: key.tonic, scale: parallelScale(key.scale) };
  const chord = diatonicChord(parallel, degree, opts);
  return { ...chord, key, origin: "borrowed" };
}

/**
 * A dominant 7th chord a fifth above the target degree: V/V, V/ii, and so on.
 *
 * Borrowing a dominant from another key momentarily makes that degree feel
 * like a tonic, which is why it pulls so strongly.
 */
export function secondaryDominant(key: Key, targetDegree: number, opts: ChordOptions = {}): Chord {
  const extension = opts.extension ?? "seventh";
  const targetInterval = scaleInterval(key.scale, targetDegree);
  const rootInterval = targetInterval + 7;

  const intervals = extension === "triad" ? [0, 4, 7] : [0, 4, 7, 10];

  return {
    root: normalize(key.tonic + rootInterval),
    intervals,
    quality: identifyQuality(intervals),
    degree: ((targetDegree % 7) + 7) % 7,
    key,
    origin: "secondaryDominant",
    target: ((targetDegree % 7) + 7) % 7,
  };
}

const SUFFIX: Record<ChordQuality, string> = {
  major: "", minor: "m", diminished: "°", augmented: "+",
  sus2: "sus2", sus4: "sus4",
  major7: "maj7", dominant7: "7", minor7: "m7",
  halfDiminished7: "m7♭5", diminished7: "°7", minorMajor7: "mMaj7",
  major9: "maj9", dominant9: "9", minor9: "m9",
  unknown: "?",
};

/**
 * How far the root sits from where the key expects that degree, in semitones.
 * -1 means flattened (the ♭VII of a borrowed chord), +1 raised.
 */
function rootShift(chord: Chord): number {
  if (chord.origin === "secondaryDominant") return 0;
  const expected = normalize(chord.key.tonic + scaleInterval(chord.key.scale, chord.degree));
  return ((chord.root - expected + 18) % 12) - 6;
}

/**
 * Absolute name, e.g. "Cmaj7", "G7", "Bm7♭5".
 *
 * A flattened root takes a flat spelling even in a sharp key: the borrowed
 * chord in C major is B♭, never A#. Same pitch, but only one of them is how a
 * musician would write it.
 */
export function chordName(chord: Chord): string {
  const flats = keyPrefersFlats(chord.key) || rootShift(chord) < 0;
  return noteName(chord.root, flats) + SUFFIX[chord.quality];
}

const NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII"] as const;

const MINOR_QUALITIES: ReadonlySet<ChordQuality> = new Set([
  "minor", "diminished", "minor7", "halfDiminished7", "diminished7", "minorMajor7", "minor9",
]);

/**
 * Roman numeral relative to the key: uppercase major, lowercase minor,
 * ° diminished, + augmented, ♭ prefix for a borrowed root outside the key.
 */
export function romanNumeral(chord: Chord): string {
  if (chord.origin === "secondaryDominant") {
    const targetChord = diatonicChord(chord.key, chord.target ?? chord.degree);
    return `V/${romanNumeral(targetChord)}`;
  }

  const base = NUMERALS[chord.degree]!;
  const lower = MINOR_QUALITIES.has(chord.quality);
  let numeral = lower ? base.toLowerCase() : base;

  const shift = rootShift(chord);
  if (shift === -1) numeral = `♭${numeral}`;
  else if (shift === 1) numeral = `♯${numeral}`;

  if (chord.quality === "diminished" || chord.quality === "diminished7") numeral += "°";
  else if (chord.quality === "halfDiminished7") numeral += "ø";
  else if (chord.quality === "augmented") numeral += "+";

  if (chord.quality === "dominant7" || chord.quality === "minor7" || chord.quality === "minorMajor7") {
    numeral += "7";
  } else if (chord.quality === "major7") numeral += "maj7";
  else if (chord.quality.endsWith("9")) numeral += "9";
  else if (chord.quality === "sus2" || chord.quality === "sus4") numeral += chord.quality;

  return numeral;
}

export type HarmonicFunction = "tonic" | "subdominant" | "dominant";

/**
 * Which of the three classical roles a degree plays. Progressions tend to move
 * tonic -> subdominant -> dominant -> tonic, and that shape is what the
 * suggestion engine leans on.
 *
 * Approximate by design: real analysis depends on context and voicing.
 */
export function harmonicFunction(degree: number, key: Key): HarmonicFunction {
  const d = ((degree % 7) + 7) % 7;
  const table: HarmonicFunction[] = isMajorIsh(key.scale)
    ? ["tonic", "subdominant", "tonic", "subdominant", "dominant", "tonic", "dominant"]
    : ["tonic", "subdominant", "tonic", "subdominant", "dominant", "subdominant", "dominant"];
  return table[d]!;
}

/** The pitch classes a chord contains, unordered. */
export function chordPitchClasses(chord: Chord): PitchClass[] {
  return chord.intervals.map((i) => normalize(chord.root + i));
}
