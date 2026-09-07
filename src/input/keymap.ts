import { toMidi } from "../core/voicing.ts";
import type { KeyEvent, NoteEvent } from "./types.ts";

/**
 * The layout every tracker and DAW uses: two rows of the QWERTY keyboard laid
 * out like piano keys, the home row white and the row above it black.
 *
 *   q 2 w 3 e r 5 t 6 y 7 u     upper octave
 *   z s x d c v g b h n j m     lower octave
 */
const PIANO_LAYOUT: ReadonlyMap<string, number> = new Map([
  ["z", 0], ["s", 1], ["x", 2], ["d", 3], ["c", 4], ["v", 5],
  ["g", 6], ["b", 7], ["h", 8], ["n", 9], ["j", 10], ["m", 11],
  ["q", 12], ["2", 13], ["w", 14], ["3", 15], ["e", 16], ["r", 17],
  ["5", 18], ["t", 19], ["6", 20], ["y", 21], ["7", 22], ["u", 23],
]);

export const OCTAVE_DOWN_KEY = ",";
export const OCTAVE_UP_KEY = ".";

export interface KeymapOptions {
  /** Octave of the lowest key (`z`). 4 puts it at middle C. */
  baseOctave?: number;
  velocity?: number;
}

const MIN_OCTAVE = 0;
const MAX_OCTAVE = 8;

/** Translates key events into note events using a piano-style layout. */
export class PianoKeymap {
  #baseOctave: number;
  readonly #velocity: number;

  constructor(opts: KeymapOptions = {}) {
    this.#baseOctave = opts.baseOctave ?? 4;
    this.#velocity = opts.velocity ?? 0.78;
  }

  get baseOctave(): number {
    return this.#baseOctave;
  }

  /** The pitch a key maps to right now, or undefined if it is not a note key. */
  pitchFor(key: number): number | undefined {
    const semitone = PIANO_LAYOUT.get(String.fromCodePoint(key));
    if (semitone === undefined) return undefined;
    return toMidi(0, this.#baseOctave) + semitone;
  }

  /**
   * Convert a key event to a note event.
   *
   * Repeat events are deliberately dropped. Autorepeat fires many times while a
   * key is held, and turning each into a noteOn would retrigger the envelope
   * continuously -- a machine-gun stutter instead of a held note. Only the
   * genuine press and release matter.
   */
  translate(event: KeyEvent): NoteEvent | undefined {
    if (event.type === "repeat") return undefined;

    const char = String.fromCodePoint(event.key);
    if (event.type === "press") {
      if (char === OCTAVE_DOWN_KEY) {
        this.#baseOctave = Math.max(MIN_OCTAVE, this.#baseOctave - 1);
        return undefined;
      }
      if (char === OCTAVE_UP_KEY) {
        this.#baseOctave = Math.min(MAX_OCTAVE, this.#baseOctave + 1);
        return undefined;
      }
    }

    const pitch = this.pitchFor(event.key);
    if (pitch === undefined) return undefined;

    return {
      type: event.type === "press" ? "noteOn" : "noteOff",
      pitch,
      velocity: this.#velocity,
      source: "keyboard",
    };
  }
}
