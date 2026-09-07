import {
  borrowedChord, diatonicChord, secondaryDominant,
  type Chord, type Extension, type Suspension,
} from "../core/chord.ts";
import { suggestNext, type Suggestion } from "../core/suggest.ts";
import { parallelScale, type Key } from "../core/theory.ts";
import { voiceChord, voiceLead } from "../core/voicing.ts";
import type { NoteEvent } from "../input/types.ts";

/** Which flavour of chord a degree produces, chosen by modifier at press time. */
export type PadMode = "diatonic" | "borrowed" | "secondary";

export interface ChordPadOptions {
  key?: Key;
  octave?: number;
  velocity?: number;
  /** How many past chords feed the suggestion engine. */
  historyLimit?: number;
}

/** One of the seven pads, with everything the view needs to draw it. */
export interface PadDegree {
  degree: number;
  chord: Chord;
  /** Suggestion weight 0..1, or 0 when this degree is not being suggested. */
  weight: number;
  held: boolean;
}

export interface ChordPadState {
  key: Key;
  extension: Extension;
  suspension: Suspension;
  octave: number;
  voiceLeading: boolean;
  history: readonly number[];
  /** Chords sounding right now, in press order. */
  sounding: readonly { degree: number; chord: Chord; pitches: readonly number[] }[];
  suggestions: readonly Suggestion[];
  /** The seven pads, always in degree order. */
  pads: readonly PadDegree[];
}

const EXTENSIONS: readonly Extension[] = ["triad", "seventh", "ninth"];
const SUSPENSIONS: readonly Suspension[] = ["none", "sus2", "sus4"];

/**
 * The instrument: degrees in, notes out.
 *
 * Holds no I/O and no terminal state, so it is fully testable and the TUI in 1e
 * only has to render `state`. This is the Nopia idea -- buttons are harmonic
 * *functions* in a key rather than absolute chords, so there are no wrong
 * answers to press.
 */
export class ChordPad {
  #key: Key;
  #octave: number;
  #extension: Extension = "triad";
  #suspension: Suspension = "none";
  #voiceLeading = true;
  readonly #velocity: number;
  readonly #historyLimit: number;

  readonly #history: number[] = [];
  readonly #held = new Map<number, { chord: Chord; pitches: number[] }>();
  #lastVoicing: number[] | undefined;

  constructor(opts: ChordPadOptions = {}) {
    this.#key = opts.key ?? { tonic: 0, scale: "major" };
    this.#octave = opts.octave ?? 4;
    this.#velocity = opts.velocity ?? 0.8;
    this.#historyLimit = opts.historyLimit ?? 8;
  }

  get state(): ChordPadState {
    const suggestions = suggestNext(this.#key, this.#history);

    // Only diatonic suggestions map onto a pad; a V/x lives on the same degree
    // as its target and would otherwise overwrite it.
    const weights = new Map<number, number>();
    for (const s of suggestions) {
      if (s.chord.origin === "diatonic") weights.set(s.degree, s.weight);
    }

    return {
      key: this.#key,
      extension: this.#extension,
      suspension: this.#suspension,
      octave: this.#octave,
      voiceLeading: this.#voiceLeading,
      history: [...this.#history],
      sounding: [...this.#held.entries()].map(([degree, v]) => ({
        degree, chord: v.chord, pitches: [...v.pitches],
      })),
      suggestions,
      pads: Array.from({ length: 7 }, (_, degree) => ({
        degree,
        chord: this.chordFor(degree),
        weight: weights.get(degree) ?? 0,
        held: this.#held.has(degree),
      })),
    };
  }

  /** Build the chord a degree would produce right now, without playing it. */
  chordFor(degree: number, mode: PadMode = "diatonic"): Chord {
    const opts = { extension: this.#extension, suspension: this.#suspension };
    if (mode === "borrowed") return borrowedChord(this.#key, degree, opts);
    if (mode === "secondary") {
      return secondaryDominant(this.#key, degree, {
        extension: this.#extension === "triad" ? "triad" : "seventh",
      });
    }
    return diatonicChord(this.#key, degree, opts);
  }

  press(degree: number, mode: PadMode = "diatonic"): NoteEvent[] {
    if (this.#held.has(degree)) return [];

    const chord = this.chordFor(degree, mode);
    const pitches = this.#voiceLeading
      ? voiceLead(chord, this.#lastVoicing, this.#centerPitch())
      : voiceChord(chord, { octave: this.#octave });

    this.#held.set(degree, { chord, pitches });
    this.#lastVoicing = pitches;

    this.#history.push(degree);
    while (this.#history.length > this.#historyLimit) this.#history.shift();

    return pitches.map((pitch) => ({
      type: "noteOn" as const, pitch, velocity: this.#velocity, source: "chord-pad",
    }));
  }

  release(degree: number): NoteEvent[] {
    const held = this.#held.get(degree);
    if (!held) return [];
    this.#held.delete(degree);

    return held.pitches.map((pitch) => ({
      type: "noteOff" as const, pitch, velocity: 0, source: "chord-pad",
    }));
  }

  /** Release everything currently sounding. */
  releaseAll(): NoteEvent[] {
    const events: NoteEvent[] = [];
    for (const degree of [...this.#held.keys()]) events.push(...this.release(degree));
    return events;
  }

  cycleExtension(): Extension {
    const next = (EXTENSIONS.indexOf(this.#extension) + 1) % EXTENSIONS.length;
    this.#extension = EXTENSIONS[next]!;
    return this.#extension;
  }

  cycleSuspension(): Suspension {
    const next = (SUSPENSIONS.indexOf(this.#suspension) + 1) % SUSPENSIONS.length;
    this.#suspension = SUSPENSIONS[next]!;
    return this.#suspension;
  }

  toggleVoiceLeading(): boolean {
    this.#voiceLeading = !this.#voiceLeading;
    return this.#voiceLeading;
  }

  /** Move the key by semitones. History stays valid: degrees are relative. */
  transpose(semitones: number): Key {
    this.#key = { ...this.#key, tonic: (((this.#key.tonic + semitones) % 12) + 12) % 12 };
    return this.#key;
  }

  /** Swap to the parallel mode — the same tonic, opposite colour. */
  toggleScale(): Key {
    this.#key = { ...this.#key, scale: parallelScale(this.#key.scale) };
    return this.#key;
  }

  shiftOctave(delta: number): number {
    this.#octave = Math.max(1, Math.min(7, this.#octave + delta));
    this.#lastVoicing = undefined;   // let voice leading re-centre on the new octave
    return this.#octave;
  }

  clearHistory(): void {
    this.#history.length = 0;
  }

  #centerPitch(): number {
    return 12 * (this.#octave + 1);
  }
}
