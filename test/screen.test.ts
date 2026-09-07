import test from "node:test";
import assert from "node:assert/strict";
import { Screen, type ScreenOutput } from "../src/tui/screen.ts";

function fakeOut(columns = 80, rows = 24) {
  const writes: string[] = [];
  let listener: (() => void) | undefined;
  const out: ScreenOutput = {
    columns, rows,
    write(data) { writes.push(data); return true; },
    on(_e, fn) { listener = fn; },
    off() { listener = undefined; },
  };
  return { out, writes, resize: () => listener?.() };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("entering takes the alternate buffer and hides the cursor", () => {
  const { out, writes } = fakeOut();
  const screen = new Screen({ out });
  screen.start();
  const first = writes.join("");
  assert.ok(first.includes("\x1b[?1049h"), "alt buffer");
  assert.ok(first.includes("\x1b[?25l"), "hide cursor");
  screen.stop();
});

test("leaving restores the cursor and the user's screen", () => {
  const { out, writes } = fakeOut();
  const screen = new Screen({ out });
  screen.start();
  writes.length = 0;
  screen.stop();
  const last = writes.join("");
  assert.ok(last.includes("\x1b[?25h"), "show cursor");
  assert.ok(last.includes("\x1b[?1049l"), "leave alt buffer");
});

test("stop is idempotent so double cleanup is harmless", () => {
  const { out } = fakeOut();
  const screen = new Screen({ out });
  screen.start();
  screen.stop();
  assert.doesNotThrow(() => screen.stop());
});

test("an unchanged frame is not redrawn", () => {
  const { out, writes } = fakeOut();
  const screen = new Screen({ out });
  screen.start();
  writes.length = 0;

  screen.render(["hello", "world"]);
  assert.equal(writes.length, 1);

  screen.render(["hello", "world"]);
  assert.equal(writes.length, 1, "identical frame should be skipped");

  screen.render(["hello", "there"]);
  assert.equal(writes.length, 2, "changed frame should draw");
  screen.stop();
});

test("resize is debounced into a single repaint", async () => {
  const { out, resize } = fakeOut();
  const screen = new Screen({ out, resizeDebounceMs: 20 });
  let repaints = 0;
  screen.onResize(() => repaints++);
  screen.start();

  // A drag: many events in quick succession.
  for (let i = 0; i < 25; i++) resize();
  assert.equal(repaints, 0, "should not paint mid-drag");

  await sleep(60);
  assert.equal(repaints, 1, "should paint once after settling");
  screen.stop();
});

test("resize invalidates the frame cache", async () => {
  const { out, writes, resize } = fakeOut();
  const screen = new Screen({ out, resizeDebounceMs: 10 });
  screen.start();
  screen.render(["a"]);
  writes.length = 0;

  resize();
  await sleep(30);

  // The terminal cleared itself on resize, so the same content must redraw.
  screen.render(["a"]);
  assert.equal(writes.length, 1, "cache should have been invalidated");
  screen.stop();
});

test("reports dimensions, falling back when the stream has none", () => {
  const { out } = fakeOut(120, 40);
  assert.equal(new Screen({ out }).width, 120);
  assert.equal(new Screen({ out }).height, 40);

  const bare = { ...out, columns: undefined, rows: undefined };
  assert.equal(new Screen({ out: bare }).width, 80);
  assert.equal(new Screen({ out: bare }).height, 24);
});
