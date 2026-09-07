export type Waveform = "sine" | "triangle" | "sawtooth" | "square";

export const WAVEFORMS: readonly Waveform[] = [
  "sine",
  "triangle",
  "sawtooth",
  "square",
];

/**
 * Evaluate a waveform at `phase`, where phase runs 0..1 over one cycle.
 * Returns -1..1.
 *
 * Known limitation: sawtooth and square are computed naively, so they alias
 * (produce false high-frequency content) at high pitches. Audible above
 * roughly C6. The fix is polyBLEP band-limiting -- worth doing when we care
 * about the top octaves, not needed to get the engine right.
 */
export function evaluate(wave: Waveform, phase: number): number {
  switch (wave) {
    case "sine":
      return Math.sin(2 * Math.PI * phase);
    case "triangle":
      return 4 * Math.abs(phase - 0.5) - 1;
    case "sawtooth":
      return 2 * phase - 1;
    case "square":
      return phase < 0.5 ? 1 : -1;
  }
}
