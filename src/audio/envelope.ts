/** Below this level a release is treated as finished. ~ -80dB. */
const SILENCE = 1e-4;

export interface ADSRParams {
  /** Seconds from silence to full. Never 0 -- an instant attack clicks. */
  attack: number;
  /** Seconds from full down to the sustain level. */
  decay: number;
  /** Level held while the key is down, 0..1. */
  sustain: number;
  /** Seconds from the current level back to silence after noteOff. */
  release: number;
}

export type ADSRStage = "idle" | "attack" | "decay" | "sustain" | "release";

/**
 * Time constants needed for an exponential to fall from 1.0 to SILENCE.
 * ln(1 / 1e-4) is about 9.21.
 */
const DECAY_CONSTANTS = Math.log(1 / SILENCE);

/**
 * One-pole coefficient for an exponential approach to a target, scaled so the
 * move *completes* in `seconds`.
 *
 * The scaling matters. Using `seconds` directly as the time constant means the
 * level is still at 37% when the stated time has elapsed, and does not reach
 * SILENCE for roughly 9x longer -- a "0.25s release" that audibly rings for
 * over two seconds. Dividing by DECAY_CONSTANTS makes the parameter mean what
 * its name says.
 */
function coeff(seconds: number, sampleRate: number): number {
  const tau = Math.max(seconds, 1e-6) / DECAY_CONSTANTS;
  return Math.exp(-1 / Math.max(1, tau * sampleRate));
}

/**
 * A classic ADSR envelope, evaluated one sample at a time.
 *
 * Attack is linear (predictable, and reaches full level exactly); decay and
 * release are exponential (musical). Release always starts from the *current*
 * level, so releasing mid-attack glides down from wherever it got to instead
 * of jumping to the sustain level and clicking.
 */
export class ADSR {
  #stage: ADSRStage = "idle";
  #value = 0;
  readonly #attackStep: number;
  readonly #decayCoeff: number;
  readonly #releaseCoeff: number;
  readonly #sustain: number;

  constructor(params: ADSRParams, sampleRate: number) {
    this.#attackStep = params.attack > 0 ? 1 / (params.attack * sampleRate) : 1;
    this.#decayCoeff = coeff(params.decay, sampleRate);
    this.#releaseCoeff = coeff(params.release, sampleRate);
    this.#sustain = params.sustain;
  }

  get stage(): ADSRStage {
    return this.#stage;
  }

  get active(): boolean {
    return this.#stage !== "idle";
  }

  noteOn(): void {
    this.#stage = "attack";
    // Deliberately does NOT reset #value: retriggering a still-releasing
    // envelope ramps up from where it is, rather than clicking to zero.
  }

  noteOff(): void {
    if (this.#stage !== "idle") this.#stage = "release";
  }

  /** Advance one sample and return the current level, 0..1. */
  process(): number {
    switch (this.#stage) {
      case "idle":
        return 0;

      case "attack":
        this.#value += this.#attackStep;
        if (this.#value >= 1) {
          this.#value = 1;
          this.#stage = "decay";
        }
        break;

      case "decay":
        this.#value += (this.#sustain - this.#value) * (1 - this.#decayCoeff);
        if (Math.abs(this.#value - this.#sustain) < SILENCE) {
          this.#value = this.#sustain;
          // A zero sustain means the note is percussive: decay IS the whole
          // note, and it ends here rather than hanging silently forever.
          this.#stage = this.#sustain < SILENCE ? "idle" : "sustain";
        }
        break;

      case "sustain":
        this.#value = this.#sustain;
        break;

      case "release":
        this.#value += (0 - this.#value) * (1 - this.#releaseCoeff);
        if (this.#value < SILENCE) {
          this.#value = 0;
          this.#stage = "idle";
        }
        break;
    }
    return this.#value;
  }
}
