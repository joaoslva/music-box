import { DISABLE, ENABLE, parseKeyEvents, QUERY } from "./kitty.ts";
import type { InputSource, KeyEvent } from "./types.ts";

export type KeyHandler = (event: KeyEvent) => void;

/**
 * Reads Kitty keyboard protocol events from a terminal.
 *
 * Owns terminal state, so it must always be able to put it back: raw mode and
 * the protocol flags both survive process exit, and leaving either enabled
 * makes the user's shell unusable until they run `reset`.
 */
export class KittyKeyboard implements InputSource {
  readonly #handlers = new Set<KeyHandler>();
  #pending: Buffer = Buffer.alloc(0);
  #started = false;

  readonly #onData = (chunk: Buffer): void => {
    const { events, rest } = parseKeyEvents(Buffer.concat([this.#pending, chunk]));
    this.#pending = rest;
    for (const event of events) {
      for (const handler of this.#handlers) handler(event);
    }
  };

  readonly #onExit = (): void => this.stop();

  readonly #onSignal = (): void => {
    this.stop();
    process.exit(130);
  };

  onKey(handler: KeyHandler): () => void {
    this.#handlers.add(handler);
    return () => this.#handlers.delete(handler);
  }

  start(): void {
    if (this.#started) return;
    if (!process.stdin.isTTY) {
      throw new Error("Not a TTY -- keyboard input needs a real terminal");
    }
    this.#started = true;

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", this.#onData);
    process.stdout.write(ENABLE);

    // Restore no matter how we leave. Without this, a crash leaves the shell in
    // raw mode with the protocol still pushed.
    process.on("exit", this.#onExit);
    process.on("SIGINT", this.#onSignal);
    process.on("SIGTERM", this.#onSignal);
  }

  stop(): void {
    if (!this.#started) return;
    this.#started = false;

    process.stdout.write(DISABLE);
    process.stdin.off("data", this.#onData);
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();

    process.off("exit", this.#onExit);
    process.off("SIGINT", this.#onSignal);
    process.off("SIGTERM", this.#onSignal);
  }
}

/**
 * Ask the terminal whether it speaks the protocol.
 *
 * A supporting terminal answers `CSI ? <flags> u`; others stay silent, so the
 * negative result is a timeout rather than a reply.
 */
export function detectKittyProtocol(timeoutMs = 300): Promise<boolean> {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve(false);
      return;
    }

    const finish = (supported: boolean): void => {
      clearTimeout(timer);
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve(supported);
    };

    const onData = (chunk: Buffer): void => {
      finish(/\x1b\[\?\d+u/.test(chunk.toString("latin1")));
    };

    const timer = setTimeout(() => finish(false), timeoutMs);

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", onData);
    process.stdout.write(QUERY);
  });
}
