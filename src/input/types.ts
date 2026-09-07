export interface Modifiers {
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
  super: boolean;
}

export const NO_MODIFIERS: Modifiers = {
  shift: false, alt: false, ctrl: false, super: false,
};

/** Kitty reports these separately; ordinary terminals cannot distinguish them. */
export type KeyEventType = "press" | "repeat" | "release";

export interface KeyEvent {
  /** Unicode codepoint of the key in the base layout (lowercase, unshifted). */
  key: number;
  modifiers: Modifiers;
  type: KeyEventType;
}

/**
 * The shared internal note event. Every input source produces these -- computer
 * keyboard today, a MIDI controller or the chord engine later -- so the audio
 * engine never learns where a note came from.
 *
 * Deliberately not a MIDI message: velocity is a float, and later fields can
 * carry harmonic meaning that MIDI has no room for. See docs/midi.md.
 */
export interface NoteEvent {
  type: "noteOn" | "noteOff";
  pitch: number;
  /** 0..1. Converted to MIDI's 0-127 only at the boundary. */
  velocity: number;
  source: string;
}

export interface InputSource {
  start(): void;
  stop(): void;
}
