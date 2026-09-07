import {
  diatonicChord, harmonicFunction, romanNumeral, secondaryDominant,
  type Chord, type ChordOptions,
} from "./chord.ts";
import { isMajorIsh, type Key } from "./theory.ts";

export interface Suggestion {
  chord: Chord;
  /** Scale degree, or the tonicised degree for a secondary dominant. */
  degree: number;
  /** Relative likelihood, normalised so the returned set sums to 1. */
  weight: number;
  /** Why this is being suggested, in words a human can check. */
  reason: string;
}

export interface SuggestOptions {
  count?: number;
  chord?: ChordOptions;
  /** Offer V/x alongside the diatonic options. */
  includeSecondary?: boolean;
}

/**
 * First-order transition weights between scale degrees.
 *
 * These encode common-practice tendency, not a hard rule: V wants to resolve to
 * I, ii sets up V, vii° leans hard on I. Deliberately weights rather than a
 * model, so every suggestion can explain itself.
 */
const MAJOR_TRANSITIONS: Record<number, Record<number, number>> = {
  0: { 4: 0.30, 3: 0.22, 5: 0.18, 1: 0.15, 2: 0.08, 6: 0.07 },
  1: { 4: 0.45, 6: 0.15, 0: 0.15, 3: 0.13, 2: 0.06, 5: 0.06 },
  2: { 5: 0.35, 3: 0.25, 1: 0.15, 0: 0.13, 4: 0.12 },
  3: { 4: 0.32, 0: 0.28, 1: 0.15, 5: 0.13, 2: 0.06, 6: 0.06 },
  4: { 0: 0.45, 5: 0.20, 3: 0.15, 1: 0.10, 2: 0.05, 6: 0.05 },
  5: { 3: 0.28, 1: 0.25, 4: 0.22, 0: 0.15, 2: 0.10 },
  6: { 0: 0.55, 5: 0.20, 2: 0.15, 4: 0.10 },
};

const MINOR_TRANSITIONS: Record<number, Record<number, number>> = {
  0: { 4: 0.28, 3: 0.22, 5: 0.18, 6: 0.15, 2: 0.10, 1: 0.07 },
  1: { 4: 0.45, 0: 0.20, 6: 0.15, 3: 0.10, 5: 0.10 },
  2: { 5: 0.30, 6: 0.25, 3: 0.20, 0: 0.15, 4: 0.10 },
  3: { 0: 0.35, 4: 0.30, 5: 0.15, 6: 0.12, 1: 0.08 },
  4: { 0: 0.50, 5: 0.20, 3: 0.15, 2: 0.08, 6: 0.07 },
  5: { 6: 0.28, 3: 0.22, 4: 0.20, 2: 0.15, 0: 0.15 },
  6: { 2: 0.35, 0: 0.30, 5: 0.20, 3: 0.15 },
};

/** Progressions common enough that recognising one is worth a nudge. */
const PROGRESSIONS: readonly (readonly number[])[] = [
  [0, 4, 5, 3],
  [5, 3, 0, 4],
  [0, 5, 3, 4],
  [1, 4, 0],
  [0, 3, 4, 0],
  [5, 1, 4, 0],
  [0, 3, 5, 4],
  [2, 5, 1, 4],
];

/** Weight added per chord of matched context. */
const PROGRESSION_BONUS = 0.12;

/** Secondary dominants delay resolution, so they rank below the plain option. */
const SECONDARY_SCALE = 0.35;

function transitions(key: Key): Record<number, Record<number, number>> {
  return isMajorIsh(key.scale) ? MAJOR_TRANSITIONS : MINOR_TRANSITIONS;
}

function describeProgression(key: Key, degrees: readonly number[]): string {
  return degrees.map((d) => romanNumeral(diatonicChord(key, d))).join("–");
}

/**
 * If the recent history is walking a known progression, report which one and
 * how many chords of context matched. Progressions are treated as cyclic,
 * since they are almost always looped.
 */
function matchProgression(
  history: readonly number[],
  candidate: number,
): { length: number; degrees: readonly number[] } | undefined {
  for (const progression of PROGRESSIONS) {
    const n = progression.length;
    for (let start = 0; start < n; start++) {
      const maxContext = Math.min(history.length, n - 1);
      for (let k = maxContext; k >= 2; k--) {
        const tail = history.slice(-k);
        const aligns = tail.every((d, i) => progression[(start + i) % n] === d);
        if (aligns && progression[(start + k) % n] === candidate) {
          return { length: k, degrees: progression };
        }
      }
    }
  }
  return undefined;
}

function reasonFor(
  key: Key,
  previous: number | undefined,
  candidate: number,
  progression: { degrees: readonly number[] } | undefined,
): string {
  if (progression) return `continues ${describeProgression(key, progression.degrees)}`;
  if (previous === undefined) return "a natural place to start";

  if (candidate === 0 && (previous === 4 || previous === 6)) return "resolves home to the tonic";
  if (previous === 4 && candidate === 5) return "deceptive cadence — expects I, lands on vi";
  if (candidate === 4 && previous === 1) return "completes the ii–V setup";
  if (candidate === 4) return "sets up the strongest pull back to the tonic";

  const from = harmonicFunction(previous, key);
  const to = harmonicFunction(candidate, key);
  if (from === "tonic" && to === "subdominant") return "steps away from home";
  if (from === "subdominant" && to === "dominant") return "builds tension toward the dominant";
  if (from === "dominant" && to === "tonic") return "releases the tension";
  if (from === to) return `stays in ${to} territory`;

  return `common after ${romanNumeral(diatonicChord(key, previous))}`;
}

/**
 * Rank the chords that could plausibly come next.
 *
 * Rules and weights rather than a trained model, deliberately: every result
 * carries a reason you can argue with, which matters when a suggestion feels
 * wrong and you want to know why it was offered.
 */
export function suggestNext(
  key: Key,
  history: readonly number[],
  opts: SuggestOptions = {},
): Suggestion[] {
  const count = opts.count ?? 5;
  const chordOpts = opts.chord ?? {};
  const includeSecondary = opts.includeSecondary ?? true;

  const previous = history.length > 0 ? history[history.length - 1] : undefined;
  const table = transitions(key);
  const row = previous === undefined ? undefined : table[previous];

  const scored: Suggestion[] = [];

  for (let degree = 0; degree < 7; degree++) {
    if (degree === previous) continue;   // repeating the same chord is not a suggestion

    const base = row ? (row[degree] ?? 0.02) : 1 / 7;
    const progression = matchProgression(history, degree);
    const bonus = progression ? PROGRESSION_BONUS * progression.length : 0;

    scored.push({
      chord: diatonicChord(key, degree, chordOpts),
      degree,
      weight: base + bonus,
      reason: reasonFor(key, previous, degree, progression),
    });
  }

  if (includeSecondary && previous !== undefined) {
    // Tonicising a target the progression already wants is the useful case.
    for (const target of [1, 4, 5]) {
      if (target === previous) continue;
      const targetWeight = row?.[target] ?? 0.02;
      scored.push({
        chord: secondaryDominant(key, target, { extension: "seventh" }),
        degree: target,
        weight: targetWeight * SECONDARY_SCALE,
        reason: `borrowed dominant — makes ${romanNumeral(diatonicChord(key, target))} feel like home`,
      });
    }
  }

  scored.sort((a, b) => b.weight - a.weight);
  const top = scored.slice(0, count);

  const total = top.reduce((sum, s) => sum + s.weight, 0) || 1;
  return top.map((s) => ({ ...s, weight: s.weight / total }));
}
