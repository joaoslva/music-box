import { spawn, type ChildProcess } from "node:child_process";
import type { Writable } from "node:stream";
import { CHANNELS, SAMPLE_RATE, SINK_LATENCY } from "./constants.ts";
import { monoToInterleavedPCM } from "./convert.ts";

export interface SinkOptions {
  sampleRate?: number;
  channels?: number;
  latency?: string;
}

/**
 * Audio output via `pw-cat`, PipeWire's native "play raw PCM from stdin" tool.
 *
 * Chosen over the `speaker` npm package because it needs no native compilation
 * and no node-gyp -- it is just a subprocess and a pipe.
 */
export class PwCatSink {
  readonly #proc: ChildProcess;
  readonly #stdin: Writable;
  readonly #channels: number;
  #closed = false;

  constructor(opts: SinkOptions = {}) {
    const sampleRate = opts.sampleRate ?? SAMPLE_RATE;
    const channels = opts.channels ?? CHANNELS;
    this.#channels = channels;

    this.#proc = spawn(
      "pw-cat",
      [
        "--playback", "--raw", "-",
        "--format", "s16",
        "--rate", String(sampleRate),
        "--channels", String(channels),
        "--latency", opts.latency ?? SINK_LATENCY,
      ],
      // stderr is ignored rather than piped: an unread pipe can fill and stall
      // pw-cat, and once there is a TUI, stray output would corrupt the screen.
      // The exit handler below reports failures instead.
      { stdio: ["pipe", "ignore", "ignore"] },
    );

    const stdin = this.#proc.stdin;
    if (!stdin) throw new Error("pw-cat was spawned without a writable stdin");
    this.#stdin = stdin;

    this.#proc.on("error", (err) => {
      process.stderr.write(
        `\nCould not start pw-cat: ${err.message}\n` +
          "Is PipeWire installed and running? Check with: pw-cat --help\n",
      );
      process.exitCode = 1;
      this.#closed = true;
    });

    // A dead sink means silence, which is confusing to debug. Say so loudly.
    this.#proc.on("exit", (code) => {
      if (!this.#closed && code !== 0) {
        process.stderr.write(`\npw-cat exited unexpectedly (code ${code})\n`);
      }
    });

    // EPIPE is expected if pw-cat goes away first; do not crash on it.
    this.#stdin.on("error", () => {});
  }

  /**
   * Write `count` mono frames. Returns false when the pipe is full.
   *
   * NOTE: backpressure here is a safety net, not the clock. A default OS pipe
   * buffer holds ~340ms of audio at our block size, so waiting for it would
   * make the instrument unplayable. AudioEngine paces against the wall clock.
   */
  write(mono: Float32Array, count: number): boolean {
    if (this.#closed) return false;

    // A fresh buffer per write, deliberately: Writable.write() retains the
    // chunk by reference when it cannot flush immediately, so a reused scratch
    // buffer would corrupt audio still sitting in the queue. allocUnsafe is
    // safe here because monoToInterleavedPCM overwrites every byte.
    const pcm = Buffer.allocUnsafe(count * this.#channels * 2);
    monoToInterleavedPCM(mono, count, this.#channels, pcm);

    return this.#stdin.write(pcm);
  }

  onDrain(fn: () => void): void {
    this.#stdin.once("drain", fn);
  }

  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.#stdin.end();
  }
}
