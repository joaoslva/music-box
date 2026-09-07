/** Frames per second, per channel. 48kHz is PipeWire's native rate here. */
export const SAMPLE_RATE = 48_000;

/** Output channel count. Voices render mono; the sink fans out to stereo. */
export const CHANNELS = 2;

/**
 * Frames rendered per block. 256 frames = 5.33ms at 48kHz.
 * Smaller means lower latency but more per-block overhead.
 */
export const BLOCK_SIZE = 256;

/**
 * How far ahead of the wall clock the engine keeps the output buffer filled.
 *
 * This is the latency knob. It exists because pipe backpressure alone is a poor
 * clock for a live instrument: a default OS pipe buffer is 64KB, which at
 * 1024 bytes per block is ~64 blocks -- roughly 340ms of audio queued before
 * write() ever returns false. Fine for bulk playback, unplayable for an
 * instrument. So we schedule against the clock instead and keep only this much
 * in flight.
 */
export const TARGET_BUFFER_SEC = 0.015;

/** Requested latency inside pw-cat itself, on top of TARGET_BUFFER_SEC. */
export const SINK_LATENCY = "10ms";
