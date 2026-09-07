import { monoToInterleavedPCM } from "./convert.ts";

export interface WavOptions {
  sampleRate: number;
  channels: number;
}

/**
 * Encode a mono float buffer as a 16-bit PCM WAV file.
 *
 * Offline rendering is what makes the audio engine testable: a test can assert
 * on actual samples instead of on whether something sounded right.
 */
export function encodeWav(mono: Float32Array, opts: WavOptions): Buffer {
  const { sampleRate, channels } = opts;
  const frames = mono.length;
  const bytesPerFrame = channels * 2;

  const data = Buffer.alloc(frames * bytesPerFrame);
  monoToInterleavedPCM(mono, frames, channels, data);

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);           // fmt chunk size
  header.writeUInt16LE(1, 20);            // format 1 = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * bytesPerFrame, 28); // byte rate
  header.writeUInt16LE(bytesPerFrame, 32);              // block align
  header.writeUInt16LE(16, 34);                         // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);

  return Buffer.concat([header, data]);
}
