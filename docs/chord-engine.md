# The chord engine

The differentiating feature, and pure logic — no audio, no terminal, no I/O.
Lives in `src/core/`, fully unit tested.

## The central idea: stack thirds inside the scale

The obvious implementation hardcodes the familiar pattern: degree 1 is major,
degree 2 is minor, degree 7 is diminished. That works for the major scale and
breaks everywhere else.

Instead, a chord on degree *d* is built from scale degrees `d`, `d+2`, `d+4`
(plus `d+6` for a seventh, `d+8` for a ninth), wrapping into higher octaves.
Quality is then **derived** from the resulting intervals rather than declared.

```ts
const relative = (step) => scaleInterval(scale, degree + step) - rootInterval;
const intervals = [0, relative(2), relative(4)];
```

The payoff is that dorian, phrygian and mixolydian work unchanged. D dorian
yields `Dm Em F G Am B° C` — and the major **IV** chord that makes dorian sound
unlike ordinary minor falls out on its own, with no special case.

## Representation

```ts
interface Chord {
  root: PitchClass;               // 0-11
  intervals: readonly number[];   // semitones above root, starting at 0
  quality: ChordQuality;          // derived by lookup
  degree: number;                 // 0-6 within the key
  key: Key;
  origin: "diatonic" | "borrowed" | "secondaryDominant";
}
```

Quality comes from a table keyed on `intervals.join(",")` — `"0,4,7"` is major,
`"0,3,6,10"` is half-diminished, and so on.

## Roman numerals, and a spelling trap

Numerals are computed from the degree and quality: uppercase major, lowercase
minor, `°` diminished, `ø` half-diminished, `+` augmented, with a `♭` or `♯`
prefix when a borrowed root sits outside the key.

**The trap:** a borrowed ♭VII in C major must display as **B♭**, never A#. Same
pitch class, but only one is how a musician writes it. `chordName()` therefore
prefers flats when the key does *or* when the root is flattened relative to the
diatonic expectation. This was a real bug caught by tests.

Related: `FLAT_NAMES` uses the Unicode `♭`, matching the quality suffixes
(`m7♭5`), so names never mix ASCII `b` with `♭`.

## Harmonic function

Every degree is classified tonic / subdominant / dominant. Progressions tend to
move **T → S → D → T**, and that shape is what the suggestion engine leans on.

| | I | ii | iii | IV | V | vi | vii° |
|---|---|---|---|---|---|---|---|
| major-ish | T | S | T | S | D | T | D |
| minor-ish | T | S | T | S | D | S | D |

Approximate by design — real analysis depends on context and voicing.

## Beyond the diatonic

- **Borrowed chords** (`borrowedChord`): the same degree taken from the
  parallel mode. This is where ♭VII, ♭VI, ♭III and iv in a major key come from.
- **Secondary dominants** (`secondaryDominant`): a dominant 7th a fifth above
  the target, written `V/V`, `V/vi`. Borrowing a dominant from another key
  briefly makes that degree feel like a tonic, which is why it pulls so hard.

## Voicing and voice leading

`voiceChord()` realises a chord as MIDI pitches in a chosen octave and
inversion. `voiceLead()` is the one that matters musically: it searches
inversions across octaves 2–6 and picks whichever moves least from the previous
chord, balanced against a pull toward a target register.

Without it, a chord player leaps around the keyboard and sounds mechanical.
With it, common tones stay put and the rest move by a step or two — what a
keyboard player does without thinking. The register pull is not optional: a
naive "nearest inversion" rule drifts off the top of the keyboard within about
twenty chords. There is a test for exactly that.

## Suggestions

`suggestNext(key, history)` ranks what could come next. Three inputs:

1. **First-order transition weights** between degrees, separate tables for
   major-ish and minor-ish keys. V→I is 0.45; vii°→I is 0.55.
2. **Progression recognition** — eight common loops (`I–V–vi–IV`, `ii–V–I`,
   `vi–ii–V–I`, ...), matched cyclically against recent history, adding a bonus
   per chord of matched context.
3. **Secondary dominants**, offered alongside the diatonic options at a reduced
   weight since they delay resolution.

Every suggestion carries a **reason** in plain words — "resolves home to the
tonic", "deceptive cadence — expects I, lands on vi", "continues I–V–vi–IV".

This is rules and weights, not a trained model, and that is deliberate: when a
suggestion feels wrong you can see exactly why it was offered and argue with
the number. A model would only be able to shrug.

## Known limitations

- Transition weights are hand-authored from common practice. They encode a
  fairly Western, fairly tonal sensibility. Deriving them from a corpus of
  `.mid` files is an obvious later upgrade — the import path exists for it.
- Only first-order transitions. Progression matching supplies the longer
  context, but a true second-order table would be better.
- Harmonic function is a lookup, not analysis.
- No modulation: the key is fixed for a suggestion call. The `.mbp` `key` track
  is designed to carry key changes over a timeline, but nothing reads it yet.
