/**
 * A single sounding note.
 *
 * The contract is deliberately narrow: a voice is anything that can fill a
 * buffer with audio. A synth voice computes its samples from math; a sampler
 * voice (later) reads them from a recording; an audio clip (later) reads them
 * from a file. All three satisfy this interface, which is why adding them is
 * additive rather than a rewrite.
 */
export interface Voice {
  /** Begin sounding. `velocity` is 0..127, following MIDI's numbering. */
  noteOn(pitch: number, velocity: number): void;

  /** Begin the release stage. The voice stays `active` until it fades out. */
  noteOff(): void;

  /**
   * ADD `count` mono samples into `out` starting at `offset`.
   *
   * Additive, not assignment -- the caller sums many voices into one bus.
   * Implementations must not clear the buffer.
   */
  render(out: Float32Array, offset: number, count: number): void;

  /** False once the voice has fully faded and its slot can be reused. */
  readonly active: boolean;
}

/** A factory for voices. One instrument backs many simultaneous notes. */
export interface Instrument {
  createVoice(): Voice;
}

/**
 * Anything that can fill an audio block. Polyphony implements this today; the
 * timeline mixer will implement it later. The engine only knows this much.
 */
export interface RenderSource {
  render(out: Float32Array, offset: number, count: number): void;
}
