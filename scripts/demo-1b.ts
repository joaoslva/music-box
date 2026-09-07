/**
 * Milestone 1b verification: the Kitty keyboard input layer.
 *
 *   node scripts/demo-1b.ts            show key events and held notes
 *   node scripts/demo-1b.ts --play     ...and hear them
 *
 * Hold several keys at once. On a legacy terminal this is impossible: you would
 * see presses with no releases and no way to know what is still held.
 */
import { AudioEngine } from "../src/audio/engine.ts";
import { SAMPLE_RATE } from "../src/audio/constants.ts";
import { Polyphony } from "../src/audio/polyphony.ts";
import { DEFAULT_SYNTH, SynthInstrument } from "../src/audio/synth.ts";
import { pitchName } from "../src/audio/pitch.ts";
import { detectKittyProtocol, KittyKeyboard } from "../src/input/keyboard.ts";
import { PianoKeymap } from "../src/input/keymap.ts";

const play = process.argv.includes("--play");

if (!(await detectKittyProtocol())) {
  console.error(
    "This terminal does not support the Kitty keyboard protocol.\n" +
      "Run inside Kitty, Ghostty, WezTerm or foot. See docs/setup.md.",
  );
  process.exit(1);
}

const keyboard = new KittyKeyboard();
const keymap = new PianoKeymap({ baseOctave: 4 });
const held = new Set<number>();

const poly = play ? new Polyphony(new SynthInstrument(DEFAULT_SYNTH, SAMPLE_RATE), 16) : undefined;
const engine = poly ? new AudioEngine(poly) : undefined;

const out = (line: string) => process.stdout.write(`${line}\r\n`);

function redraw(): void {
  const notes = [...held].sort((a, b) => a - b).map(pitchName).join(" ") || "—";
  process.stdout.write(
    `\r\x1b[2K  octave ${keymap.baseOctave}   held: ${notes}`,
  );
}

function quit(): void {
  keyboard.stop();
  engine?.stop();
  process.stdout.write("\r\n\r\n");
  process.exit(0);
}

keyboard.onKey((event) => {
  // Raw mode disables signal generation, so Ctrl+C arrives as a key event
  // rather than SIGINT. It has to be handled here or the app cannot be quit.
  if (event.type === "press" && event.modifiers.ctrl && event.key === 99) quit();
  if (event.type === "press" && event.key === 27) quit();

  const note = keymap.translate(event);
  if (!note) {
    if (event.type === "press") redraw();   // octave keys still change the display
    return;
  }

  if (note.type === "noteOn") {
    held.add(note.pitch);
    poly?.noteOn(note.pitch, Math.round(note.velocity * 127));
  } else {
    held.delete(note.pitch);
    poly?.noteOff(note.pitch);
  }
  redraw();
});

out("");
out("  \x1b[1mmusic-box — input layer\x1b[0m");
out("");
out("    q 2 w 3 e r 5 t 6 y 7 u    upper octave");
out("    z s x d c v g b h n j m    lower octave");
out("");
out("    , .   octave down / up          esc or ctrl-c   quit");
out(play ? "    sound: on" : "    sound: off (pass --play to hear it)");
out("");

keyboard.start();
engine?.start();
redraw();
