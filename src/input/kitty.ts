import type { KeyEvent, KeyEventType, Modifiers } from "./types.ts";

const ESC = 0x1b;
const CSI_OPEN = 0x5b;   // '['
const FINAL_U = 0x75;    // 'u'

/**
 * Progressive enhancement flags we ask the terminal for.
 *
 *   1  disambiguate escape codes   (Ctrl+I stops colliding with Tab)
 *   2  report event types          (press / repeat / RELEASE -- the whole point)
 *   8  report all keys as escape codes
 *
 * Flag 8 matters more than it looks: without it, ordinary printable keys still
 * arrive as bare bytes with no release event, so `a` would be untrackable
 * exactly like on a legacy terminal.
 */
export const KITTY_FLAGS = 1 | 2 | 8;

/** Push our flags. The terminal keeps a stack, so this is restorable. */
export const ENABLE = `\x1b[>${KITTY_FLAGS}u`;

/** Pop them again, restoring whatever the shell had set. */
export const DISABLE = "\x1b[<u";

/** Ask what the terminal currently supports. Silence means "not supported". */
export const QUERY = "\x1b[?u";

function decodeModifiers(raw: number): Modifiers {
  // The wire value is the bitfield plus one, so 1 means "no modifiers".
  const bits = Math.max(0, raw - 1);
  return {
    shift: (bits & 1) !== 0,
    alt: (bits & 2) !== 0,
    ctrl: (bits & 4) !== 0,
    super: (bits & 8) !== 0,
  };
}

function decodeEventType(raw: number | undefined): KeyEventType {
  if (raw === 2) return "repeat";
  if (raw === 3) return "release";
  return "press";
}

export interface ParseResult {
  events: KeyEvent[];
  /** Bytes of an incomplete sequence, to be prepended to the next chunk. */
  rest: Buffer;
}

/**
 * Parse Kitty keyboard protocol events out of a byte stream.
 *
 * Pure and synchronous by design: terminal input is the hardest part of this
 * app to test interactively, so the parsing is separated from the I/O and gets
 * exercised with byte fixtures instead.
 *
 * Wire format: `CSI key[:alt] [; mods[:event]] [; text] u`
 */
export function parseKeyEvents(input: Buffer): ParseResult {
  const events: KeyEvent[] = [];
  let i = 0;

  while (i < input.length) {
    if (input[i] !== ESC) {
      // A bare byte. With flag 8 the terminal should not send these, but a
      // terminal that ignored our request still might -- skip rather than
      // misparse.
      i++;
      continue;
    }

    if (i + 1 >= input.length) break;             // lone ESC, wait for more

    if (input[i + 1] !== CSI_OPEN) {
      i += 2;                                     // ESC O ... and friends
      continue;
    }

    // Scan the parameter bytes: digits, ';' and ':'.
    let j = i + 2;
    while (j < input.length) {
      const byte = input[j]!;
      const isParam =
        (byte >= 0x30 && byte <= 0x39) || byte === 0x3b || byte === 0x3a;
      if (!isParam) break;
      j++;
    }

    if (j >= input.length) break;                 // incomplete, wait for more

    const final = input[j]!;
    if (final === FINAL_U) {
      const event = decodeKeyEvent(input.subarray(i + 2, j).toString("latin1"));
      if (event) events.push(event);
    }
    // Any other final byte is a CSI sequence we do not care about; skipping it
    // keeps us in sync with the stream.

    i = j + 1;
  }

  return { events, rest: Buffer.from(input.subarray(i)) };
}

function decodeKeyEvent(params: string): KeyEvent | undefined {
  const sections = params.split(";");
  const keySection = sections[0] ?? "";
  const key = Number.parseInt(keySection.split(":")[0] ?? "", 10);
  if (!Number.isFinite(key)) return undefined;

  const modSection = (sections[1] ?? "").split(":");
  const rawModifiers = Number.parseInt(modSection[0] ?? "", 10);
  const rawEvent = Number.parseInt(modSection[1] ?? "", 10);

  return {
    key,
    modifiers: decodeModifiers(Number.isFinite(rawModifiers) ? rawModifiers : 1),
    type: decodeEventType(Number.isFinite(rawEvent) ? rawEvent : undefined),
  };
}
