/**
 * Convert a mono float buffer (-1..1) to interleaved signed 16-bit PCM.
 *
 * Soft-clips with tanh rather than hard-clamping: summing several voices
 * routinely exceeds 1.0, and hard clipping sounds like harsh digital
 * distortion where tanh rolls off gracefully.
 */
export function monoToInterleavedPCM(
  mono: Float32Array,
  count: number,
  channels: number,
  out: Buffer,
): void {
  for (let i = 0; i < count; i++) {
    const soft = Math.tanh(mono[i]);
    const s16 = Math.max(-32768, Math.min(32767, Math.round(soft * 32767)));
    for (let c = 0; c < channels; c++) {
      out.writeInt16LE(s16, (i * channels + c) * 2);
    }
  }
}
