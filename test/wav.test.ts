import test from "node:test";
import assert from "node:assert/strict";
import { encodeWav } from "../src/audio/wav.ts";

test("writes a well-formed 16-bit PCM header", () => {
  const wav = encodeWav(new Float32Array(100), { sampleRate: 48_000, channels: 2 });

  assert.equal(wav.subarray(0, 4).toString(), "RIFF");
  assert.equal(wav.subarray(8, 12).toString(), "WAVE");
  assert.equal(wav.subarray(12, 16).toString(), "fmt ");
  assert.equal(wav.readUInt16LE(20), 1, "format should be PCM");
  assert.equal(wav.readUInt16LE(22), 2, "channels");
  assert.equal(wav.readUInt32LE(24), 48_000, "sample rate");
  assert.equal(wav.readUInt32LE(28), 48_000 * 4, "byte rate");
  assert.equal(wav.readUInt16LE(32), 4, "block align");
  assert.equal(wav.readUInt16LE(34), 16, "bits per sample");
  assert.equal(wav.subarray(36, 40).toString(), "data");
});

test("length matches frames x channels x 2 bytes, plus the 44-byte header", () => {
  const wav = encodeWav(new Float32Array(1000), { sampleRate: 48_000, channels: 2 });
  assert.equal(wav.readUInt32LE(40), 1000 * 2 * 2, "declared data size");
  assert.equal(wav.length, 44 + 1000 * 2 * 2);
  assert.equal(wav.readUInt32LE(4), wav.length - 8, "RIFF size counts all but the first 8 bytes");
});

test("soft-clips instead of wrapping around on overload", () => {
  // Hard clipping would wrap a +2.0 sample to a large negative number, which
  // is heard as vicious distortion. tanh must keep it positive and in range.
  const wav = encodeWav(new Float32Array([2, -2]), { sampleRate: 48_000, channels: 1 });
  const first = wav.readInt16LE(44);
  const second = wav.readInt16LE(46);
  assert.ok(first > 30_000 && first <= 32_767, `got ${first}`);
  assert.ok(second < -30_000 && second >= -32_768, `got ${second}`);
});
