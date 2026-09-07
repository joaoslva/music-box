/** The slice of a TTY stream a Screen needs. Narrow so tests can fake it. */
export interface ScreenOutput {
  write(data: string): boolean;
  columns?: number | undefined;
  rows?: number | undefined;
  on(event: "resize", listener: () => void): void;
  off(event: "resize", listener: () => void): void;
}

export interface ScreenOptions {
  out?: ScreenOutput;
  /**
   * Resize coalescing window. Dragging a window edge fires dozens of events per
   * second; without this every one would trigger a repaint.
   */
  resizeDebounceMs?: number;
}

const ENTER_ALT = "\x1b[?1049h";
const LEAVE_ALT = "\x1b[?1049l";
const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";
const CLEAR = "\x1b[2J";
const HOME = "\x1b[H";
const CLEAR_LINE = "\x1b[K";
const CLEAR_BELOW = "\x1b[J";

/**
 * Owns the terminal screen: the alternate buffer, the cursor, and resize.
 *
 * Deliberately knows nothing about what is being drawn -- it takes finished
 * lines. Views stay pure functions of (state, width); this is the only part
 * that touches the terminal, so it is the only part that has to be careful
 * about restoring it.
 */
export class Screen {
  readonly #out: ScreenOutput;
  readonly #debounceMs: number;
  readonly #handlers = new Set<() => void>();
  #lastFrame: string | undefined;
  #timer: NodeJS.Timeout | undefined;
  #started = false;

  constructor(opts: ScreenOptions = {}) {
    this.#out = opts.out ?? (process.stdout as unknown as ScreenOutput);
    this.#debounceMs = opts.resizeDebounceMs ?? 30;
  }

  get width(): number {
    return this.#out.columns ?? 80;
  }

  get height(): number {
    return this.#out.rows ?? 24;
  }

  readonly #onResize = (): void => {
    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      // A resize invalidates the diff: the terminal cleared itself.
      this.#lastFrame = undefined;
      for (const handler of this.#handlers) handler();
    }, this.#debounceMs);
  };

  readonly #onExit = (): void => this.stop();

  readonly #onSignal = (): void => {
    this.stop();
    process.exit(130);
  };

  onResize(handler: () => void): () => void {
    this.#handlers.add(handler);
    return () => this.#handlers.delete(handler);
  }

  start(): void {
    if (this.#started) return;
    this.#started = true;
    this.#lastFrame = undefined;

    this.#out.write(ENTER_ALT + HIDE_CURSOR + CLEAR);
    this.#out.on("resize", this.#onResize);

    process.on("exit", this.#onExit);
    process.on("SIGINT", this.#onSignal);
    process.on("SIGTERM", this.#onSignal);
  }

  stop(): void {
    if (!this.#started) return;
    this.#started = false;

    if (this.#timer !== undefined) clearTimeout(this.#timer);
    this.#timer = undefined;

    this.#out.off("resize", this.#onResize);
    this.#out.write(SHOW_CURSOR + LEAVE_ALT);

    process.off("exit", this.#onExit);
    process.off("SIGINT", this.#onSignal);
    process.off("SIGTERM", this.#onSignal);
  }

  /** Draw a frame. Identical consecutive frames are skipped. */
  render(lines: readonly string[]): void {
    const frame = HOME + lines.map((l) => l + CLEAR_LINE).join("\r\n") + CLEAR_BELOW;
    if (frame === this.#lastFrame) return;
    this.#lastFrame = frame;
    this.#out.write(frame);
  }
}
