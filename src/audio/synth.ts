import type { Instrument, Voice } from "./types.ts";
import { ADSR, type ADSRParams } from "./envelope.ts";
import { evaluate, type Waveform } from "./oscillator.ts";
import { midiToFreq } from "./pitch.ts";

export interface SynthParams {
  waveform: Waveform;
  envelope: ADSRParams;
  /** Per-voice output gain. Keep well under 1 so stacked notes have headroom. */
  gain: number;
}

export const DEFAULT_SYNTH: SynthParams = {
  waveform: "triangle",
  envelope: { attack: 0.008, decay: 0.18, sustain: 0.55, release: 0.25 },
  gain: 0.22,
};

/** A single oscillator shaped by an ADSR envelope. */
export class SynthVoice implements Voice {
  #phase = 0;
  #increment = 0;
  #amplitude = 0;
  readonly #env: ADSR;
  readonly #params: SynthParams;
  readonly #sampleRate: number;

  constructor(params: SynthParams, sampleRate: number) {
    this.#params = params;
    this.#sampleRate = sampleRate;
    this.#env = new ADSR(params.envelope, sampleRate);
  }

  get active(): boolean {
    return this.#env.active;
  }

  noteOn(pitch: number, velocity: number): void {
    this.#increment = midiToFreq(pitch) / this.#sampleRate;
    this.#amplitude = velocity / 127;
    // Phase is deliberately NOT reset. A fresh voice already starts at 0, and
    // a *stolen* voice is mid-cycle at a non-zero envelope level -- snapping
    // its phase there is an audible click. Continuity costs nothing.
    this.#env.noteOn();
  }

  noteOff(): void {
    this.#env.noteOff();
  }

  render(out: Float32Array, offset: number, count: number): void {
    if (!this.#env.active) return;
    const { waveform, gain } = this.#params;
    const level = this.#amplitude * gain;

    for (let i = 0; i < count; i++) {
      out[offset + i] += evaluate(waveform, this.#phase) * this.#env.process() * level;
      this.#phase += this.#increment;
      if (this.#phase >= 1) this.#phase -= 1;
    }
  }
}

export class SynthInstrument implements Instrument {
  readonly #params: SynthParams;
  readonly #sampleRate: number;

  constructor(params: SynthParams, sampleRate: number) {
    this.#params = params;
    this.#sampleRate = sampleRate;
  }

  createVoice(): Voice {
    return new SynthVoice(this.#params, this.#sampleRate);
  }
}
