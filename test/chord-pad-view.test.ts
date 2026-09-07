import test from "node:test";
import assert from "node:assert/strict";
import { ChordPad } from "../src/app/chord-pad.ts";
import { renderChordPad } from "../src/tui/chord-pad-view.ts";

/** Visible width, ignoring ANSI colour sequences. */
const visible = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "").length;

const pad = () => new ChordPad({ key: { tonic: 0, scale: "major" }, octave: 4 });

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

test("draws all seven pads with their numbers, numerals and names", () => {
  const text = renderChordPad(pad().state, 80).map(strip).join("\n");
  for (const n of ["1", "2", "3", "4", "5", "6", "7"]) {
    assert.ok(text.includes(n), `pad number ${n} missing`);
  }
  for (const numeral of ["I", "ii", "iii", "IV", "V", "vi", "vii°"]) {
    assert.ok(text.includes(numeral), `numeral ${numeral} missing`);
  }
  for (const name of ["C", "Dm", "Em", "F", "G", "Am", "B°"]) {
    assert.ok(text.includes(name), `chord ${name} missing`);
  }
});

test("the held pad is marked differently from a suggested one", () => {
  const p = pad();
  p.press(4);
  const lines = renderChordPad(p.state, 80);
  const joined = lines.join("\n");
  assert.ok(joined.includes("\x1b[7m"), "held pad should be inverted");
  assert.ok(joined.includes("▮"), "held pad should show the playing marker, not a meter");
});

test("suggestion strength appears as a meter under the pads", () => {
  const p = pad();
  p.press(4);
  p.release(4);
  const text = renderChordPad(p.state, 80).map(strip).join("\n");
  // V resolves to I, so I should carry the tallest bar.
  assert.ok(/[▁▂▃▄▅▆▇█]/.test(text), "expected at least one meter bar");
  assert.ok(text.includes("·"), "unsuggested degrees should show a dot");
});

test("pads stack vertically when there is no room for seven columns", () => {
  const wide = renderChordPad(pad().state, 80);
  const narrow = renderChordPad(pad().state, 34);
  assert.ok(narrow.length >= wide.length - 2, "stacked layout should still show all pads");
  const text = narrow.map(strip).join("\n");
  for (const numeral of ["I", "ii", "iii", "IV", "V", "vi", "vii°"]) {
    assert.ok(text.includes(numeral), `numeral ${numeral} lost when narrow`);
  }
});

test("renders something when nothing is playing", () => {
  const lines = renderChordPad(pad().state, 80);
  assert.ok(lines.length > 0);
  assert.ok(lines.some((l) => l.includes("press 1 to 7")));
});

test("shows the sounding chord by name, numeral and pitches", () => {
  const p = pad();
  p.press(4);
  const text = renderChordPad(p.state, 80).join("\n");
  assert.ok(text.includes("G"), "chord name");
  assert.ok(text.includes("V"), "roman numeral");
  assert.ok(text.includes("67") || text.includes("55"), "pitch numbers");
});

test("shows suggestions with a reason", () => {
  const p = pad();
  p.press(4);
  const text = renderChordPad(p.state, 80).join("\n");
  assert.ok(text.includes("next"));
  assert.ok(/resolves|continues|releases|common/.test(text), "expected a reason line");
});

test("reflects current settings so the display never lies", () => {
  const p = pad();
  p.cycleExtension();
  p.cycleSuspension();
  p.toggleVoiceLeading();
  const text = renderChordPad(p.state, 80).join("\n");
  assert.ok(text.includes("seventh"));
  assert.ok(text.includes("sus2"));
  assert.ok(text.includes("voice-leading off"));
});

test("no line overflows the given width", () => {
  const p = pad();
  p.press(0);
  for (const width of [20, 30, 40, 50, 60, 80, 120, 200]) {
    for (const line of renderChordPad(p.state, width)) {
      assert.ok(visible(line) <= width, `line of ${visible(line)} exceeded width ${width}`);
    }
  }
});

test("drops the key onto its own line rather than wrapping the header", () => {
  const lines = renderChordPad(pad().state, 28);
  assert.ok(lines.some((l) => l.includes("chord pad")));
  assert.ok(lines.some((l) => l.includes("C major")));
  assert.ok(
    !lines.some((l) => l.includes("chord pad") && l.includes("C major")),
    "header and key should be on separate lines when narrow",
  );
});

test("survives absurdly narrow terminals", () => {
  // A pure render function must not throw on a bad size -- the resize path
  // will hand it every width on the way down.
  const p = pad();
  p.press(0);
  for (const width of [1, 5, 20, 30]) {
    assert.doesNotThrow(() => renderChordPad(p.state, width), `width ${width}`);
  }
});

test("rendering is pure — same state renders identically", () => {
  const p = pad();
  p.press(2);
  assert.deepEqual(renderChordPad(p.state, 80), renderChordPad(p.state, 80));
});
