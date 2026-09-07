import { BLOCK_SIZE, SAMPLE_RATE } from "./constants.ts";
import type { Polyphony } from "./polyphony.ts";

export interface TimedEvent {
  /** Seconds from the start of the render. */
  time: number;
  type: "on" | "off";
  pitch: number;
  velocity?: number;
}

/**
 * Render events to a mono buffer as fast as the CPU allows, with no audio
 * device involved.
 *
 * This is the testability payoff of keeping the DSP a pure buffer-producer:
 * tests assert on samples, and run in milliseconds on a machine with no sound
 * card at all.
 *
 * Events fire at block boundaries, so timing is quantised to BLOCK_SIZE
 * (5.33ms). Fine for tests and for offline bounce; a sequencer needing
 * sample-accurate placement will split blocks at event times instead.
 */
export function renderOffline(
  polyphony: Polyphony,
  events: readonly TimedEvent[],
  seconds: number,
  sampleRate: number = SAMPLE_RATE,
): Float32Array {
  const totalFrames = Math.ceil(seconds * sampleRate);
  const out = new Float32Array(totalFrames);
  const queue = [...events].sort((a, b) => a.time - b.time);
  let next = 0;

  for (let frame = 0; frame < totalFrames; frame += BLOCK_SIZE) {
    const blockTime = frame / sampleRate;

    while (next < queue.length && queue[next]!.time <= blockTime) {
      const ev = queue[next]!;
      if (ev.type === "on") polyphony.noteOn(ev.pitch, ev.velocity ?? 100);
      else polyphony.noteOff(ev.pitch);
      next++;
    }

    polyphony.render(out, frame, Math.min(BLOCK_SIZE, totalFrames - frame));
  }

  return out;
}
