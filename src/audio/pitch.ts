/**
 * MIDI pitch numbering: 60 = middle C (C4), 69 = A4 = 440Hz, 12 per octave.
 *
 * We adopt MIDI's *numbering* because it is universal and free. We do not use
 * MIDI messages as an internal format -- see docs/midi.md.
 */
export function midiToFreq(pitch: number): number {
  return 440 * 2 ** ((pitch - 69) / 12);
}

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** 60 -> "C4". Octave numbering is the convention where middle C is C4. */
export function pitchName(pitch: number): string {
  const name = NAMES[((pitch % 12) + 12) % 12] ?? "?";
  return `${name}${Math.floor(pitch / 12) - 1}`;
}
