import { BLOCK_SIZE, SAMPLE_RATE, TARGET_BUFFER_SEC } from "./constants.ts";
import { PwCatSink, type SinkOptions } from "./sink.ts";
import type { RenderSource } from "./types.ts";

/** How often the pump wakes to top up the buffer. */
const TICK_MS = 2;

/** Ceiling on blocks per tick, so a clock jump cannot spin the loop. */
const MAX_BLOCKS_PER_TICK = 64;

/**
 * Drives a RenderSource in realtime and feeds the audio sink.
 *
 * Pacing is against the wall clock rather than pipe backpressure. The pipe
 * holds ~340ms at our block size, and waiting for it to fill would put that
 * much delay between pressing a key and hearing it. Instead the engine keeps
 * only TARGET_BUFFER_SEC of audio in flight, which is the latency knob.
 */
export class AudioEngine {
  readonly #source: RenderSource;
  readonly #sink: PwCatSink;
  readonly #block: Float32Array;
  #framesWritten = 0;
  #startTime = 0;
  #timer: NodeJS.Timeout | undefined;
  #running = false;
  #underruns = 0;

  constructor(source: RenderSource, sinkOptions: SinkOptions = {}) {
    this.#source = source;
    this.#sink = new PwCatSink(sinkOptions);
    this.#block = new Float32Array(BLOCK_SIZE);
  }

  /**
   * Times the buffer ran dry -- audio was needed before we produced it, which
   * is heard as a click. Non-zero means raise TARGET_BUFFER_SEC or make
   * rendering cheaper.
   */
  get underruns(): number {
    return this.#underruns;
  }

  get running(): boolean {
    return this.#running;
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#framesWritten = 0;
    this.#startTime = performance.now();
    this.#tick();
  }

  stop(): void {
    if (!this.#running) return;
    this.#running = false;
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#sink.close();
  }

  #tick = (): void => {
    if (!this.#running) return;

    const elapsed = (performance.now() - this.#startTime) / 1000;
    const buffered = this.#framesWritten / SAMPLE_RATE - elapsed;

    // The first tick is always "behind" -- the clock has advanced a fraction of
    // a millisecond since start() but nothing is written yet. That is the
    // priming fill, not a dropout.
    if (this.#framesWritten > 0 && buffered < 0) this.#underruns++;

    let blocks = 0;
    while (
      this.#framesWritten / SAMPLE_RATE - elapsed < TARGET_BUFFER_SEC &&
      blocks++ < MAX_BLOCKS_PER_TICK
    ) {
      this.#block.fill(0);
      this.#source.render(this.#block, 0, BLOCK_SIZE);
      this.#sink.write(this.#block, BLOCK_SIZE);
      this.#framesWritten += BLOCK_SIZE;
    }

    this.#timer = setTimeout(this.#tick, TICK_MS);
  };
}
