import { AudioEngine } from "../audio/engine.ts";
import { SAMPLE_RATE } from "../audio/constants.ts";
import { Polyphony } from "../audio/polyphony.ts";
import { DEFAULT_SYNTH, SynthInstrument } from "../audio/synth.ts";
import type { Key } from "../core/theory.ts";
import { detectKittyProtocol, KittyKeyboard } from "../input/keyboard.ts";
import type { NoteEvent } from "../input/types.ts";
import { renderChordPad } from "../tui/chord-pad-view.ts";
import { Screen } from "../tui/screen.ts";
import { ChordPad, type PadMode } from "./chord-pad.ts";

export interface ChordPadAppOptions {
  key?: Key;
  octave?: number;
  polyphony?: number;
}

const DEGREE_KEY_BASE = "1".codePointAt(0)!;
const KEY_C = "c".codePointAt(0)!;
const KEY_ESC = 27;

/**
 * Wires the instrument to the terminal and the speakers.
 *
 * Everything interesting lives elsewhere -- `ChordPad` is the instrument,
 * `renderChordPad` is the view, `Screen` owns the terminal. This is only the
 * glue, which is why it has no logic worth testing and everything it touches
 * does.
 */
export class ChordPadApp {
  readonly #pad: ChordPad;
  readonly #poly: Polyphony;
  readonly #engine: AudioEngine;
  readonly #keyboard = new KittyKeyboard();
  readonly #screen = new Screen();
  #running = false;

  constructor(opts: ChordPadAppOptions = {}) {
    this.#pad = new ChordPad({
      key: opts.key ?? { tonic: 0, scale: "major" },
      octave: opts.octave ?? 4,
    });
    this.#poly = new Polyphony(
      new SynthInstrument(DEFAULT_SYNTH, SAMPLE_RATE),
      opts.polyphony ?? 32,
    );
    this.#engine = new AudioEngine(this.#poly);
  }

  async start(): Promise<void> {
    if (!(await detectKittyProtocol())) {
      throw new Error(
        "This terminal does not support the Kitty keyboard protocol.\n" +
          "Run inside Kitty, Ghostty, WezTerm or foot. See docs/setup.md.",
      );
    }

    this.#running = true;
    this.#keyboard.onKey((event) => this.#handleKey(event));
    this.#screen.onResize(() => this.#draw());

    this.#screen.start();
    this.#keyboard.start();
    this.#engine.start();
    this.#draw();
  }

  stop(): void {
    if (!this.#running) return;
    this.#running = false;
    this.#apply(this.#pad.releaseAll());
    this.#keyboard.stop();
    this.#engine.stop();
    this.#screen.stop();
  }

  #draw(): void {
    this.#screen.render(renderChordPad(this.#pad.state, this.#screen.width));
  }

  #apply(events: readonly NoteEvent[]): void {
    for (const event of events) {
      if (event.type === "noteOn") {
        this.#poly.noteOn(event.pitch, Math.round(event.velocity * 127));
      } else {
        this.#poly.noteOff(event.pitch);
      }
    }
  }

  #handleKey(event: Parameters<Parameters<KittyKeyboard["onKey"]>[0]>[0]): void {
    // Raw mode suppresses signals, so Ctrl+C arrives here as an ordinary key.
    if (event.type === "press" && event.modifiers.ctrl && event.key === KEY_C) {
      this.stop();
      process.exit(0);
    }
    if (event.type === "press" && event.key === KEY_ESC) {
      this.stop();
      process.exit(0);
    }
    if (event.type === "repeat") return;

    const degree = event.key - DEGREE_KEY_BASE;
    if (degree >= 0 && degree < 7) {
      if (event.type === "press") {
        const mode: PadMode = event.modifiers.ctrl
          ? "secondary"
          : event.modifiers.shift
            ? "borrowed"
            : "diatonic";
        this.#apply(this.#pad.press(degree, mode));
      } else {
        this.#apply(this.#pad.release(degree));
      }
      this.#draw();
      return;
    }

    if (event.type !== "press") return;

    switch (String.fromCodePoint(event.key)) {
      case "q": this.#pad.cycleExtension(); break;
      case "w": this.#pad.cycleSuspension(); break;
      case "e": this.#pad.toggleVoiceLeading(); break;
      case ",": this.#pad.shiftOctave(-1); break;
      case ".": this.#pad.shiftOctave(1); break;
      case "-": this.#pad.transpose(-1); break;
      case "=": this.#pad.transpose(1); break;
      case "\\": this.#pad.toggleScale(); break;
      case "r": this.#pad.clearHistory(); break;
      default: return;
    }
    this.#draw();
  }
}
