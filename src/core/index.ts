export {
  borrowedChord, chordName, chordPitchClasses, diatonicChord, harmonicFunction,
  identifyQuality, romanNumeral, secondaryDominant,
  type Chord, type ChordOptions, type ChordOrigin, type ChordQuality,
  type Extension, type HarmonicFunction, type Suspension,
} from "./chord.ts";
export { suggestNext, type SuggestOptions, type Suggestion } from "./suggest.ts";
export {
  isMajorIsh, keyName, keyPrefersFlats, noteName, normalize, parallelScale,
  scaleInterval, scalePitchClasses, SCALES,
  type Key, type PitchClass, type ScaleName,
} from "./theory.ts";
export {
  toMidi, voiceChord, voiceLead, voiceMovement, type VoicingOptions,
} from "./voicing.ts";
