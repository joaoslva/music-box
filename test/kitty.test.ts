import test from "node:test";
import assert from "node:assert/strict";
import { parseKeyEvents } from "../src/input/kitty.ts";

const buf = (s: string) => Buffer.from(s, "latin1");
const E = "\x1b";

test("a bare key event defaults to press with no modifiers", () => {
  const { events, rest } = parseKeyEvents(buf(`${E}[97u`));
  assert.equal(rest.length, 0);
  assert.equal(events.length, 1);
  assert.equal(events[0]!.key, 97);
  assert.equal(events[0]!.type, "press");
  assert.deepEqual(events[0]!.modifiers, {
    shift: false, alt: false, ctrl: false, super: false,
  });
});

test("event types are distinguished — this is the whole reason for the protocol", () => {
  const press = parseKeyEvents(buf(`${E}[97;1:1u`)).events[0]!;
  const repeat = parseKeyEvents(buf(`${E}[97;1:2u`)).events[0]!;
  const release = parseKeyEvents(buf(`${E}[97;1:3u`)).events[0]!;

  assert.equal(press.type, "press");
  assert.equal(repeat.type, "repeat");
  assert.equal(release.type, "release");
});

test("modifiers decode from the bitfield-plus-one encoding", () => {
  const shift = parseKeyEvents(buf(`${E}[97;2:1u`)).events[0]!;
  assert.equal(shift.modifiers.shift, true);
  assert.equal(shift.modifiers.ctrl, false);

  const ctrl = parseKeyEvents(buf(`${E}[97;5:1u`)).events[0]!;
  assert.equal(ctrl.modifiers.ctrl, true);
  assert.equal(ctrl.modifiers.shift, false);

  const ctrlShift = parseKeyEvents(buf(`${E}[97;6:1u`)).events[0]!;
  assert.equal(ctrlShift.modifiers.ctrl, true);
  assert.equal(ctrlShift.modifiers.shift, true);
});

test("several events arriving in one chunk all decode", () => {
  const { events } = parseKeyEvents(buf(`${E}[97;1:1u${E}[115;1:1u${E}[97;1:3u`));
  assert.deepEqual(
    events.map((e) => [e.key, e.type]),
    [[97, "press"], [115, "press"], [97, "release"]],
  );
});

test("a sequence split across chunks is held over, not mangled", () => {
  // The realistic failure: a read() boundary lands mid-escape-sequence.
  const first = parseKeyEvents(buf(`${E}[97;1:1u${E}[11`));
  assert.equal(first.events.length, 1);
  assert.equal(first.rest.toString("latin1"), `${E}[11`);

  const second = parseKeyEvents(Buffer.concat([first.rest, buf("5;1:1u")]));
  assert.equal(second.events.length, 1);
  assert.equal(second.events[0]!.key, 115);
  assert.equal(second.rest.length, 0);
});

test("a lone ESC at the end waits for the rest", () => {
  const { events, rest } = parseKeyEvents(buf(`${E}[97u${E}`));
  assert.equal(events.length, 1);
  assert.equal(rest.toString("latin1"), E);
});

test("other CSI sequences are skipped without losing sync", () => {
  // Cursor-position reports and mouse events share the stream.
  const { events } = parseKeyEvents(buf(`${E}[97;1:1u${E}[24;80R${E}[115;1:1u`));
  assert.deepEqual(events.map((e) => e.key), [97, 115]);
});

test("stray bare bytes are skipped rather than misparsed", () => {
  const { events } = parseKeyEvents(buf(`garbage${E}[97;1:1u`));
  assert.equal(events.length, 1);
  assert.equal(events[0]!.key, 97);
});

test("malformed parameters are dropped, not crashed on", () => {
  const { events } = parseKeyEvents(buf(`${E}[u${E}[;;u${E}[97;1:1u`));
  assert.equal(events.length, 1);
  assert.equal(events[0]!.key, 97);
});

test("holding a chord produces independent presses with no releases", () => {
  // C, E, G held together: three presses, nothing released yet. This is what a
  // legacy terminal fundamentally cannot express.
  const { events } = parseKeyEvents(buf(`${E}[122;1:1u${E}[99;1:1u${E}[98;1:1u`));
  assert.equal(events.length, 3);
  assert.ok(events.every((e) => e.type === "press"));
});
