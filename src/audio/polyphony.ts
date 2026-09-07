import type { Instrument, Voice } from "./types.ts";

interface Slot {
  voice: Voice;
  /** Pitch this slot was last allocated to, or -1 if never used. */
  pitch: number;
  /** Allocation order, used to pick the oldest voice when stealing. */
  serial: number;
}

export const DEFAULT_POLYPHONY = 16;

/**
 * Owns a fixed pool of voices and routes note events to them.
 *
 * A fixed pool matters for a realtime audio path: allocating during rendering
 * invites a GC pause, and a GC pause mid-block is an audible click.
 */
export class Polyphony {
  readonly #slots: Slot[] = [];
  readonly #byPitch = new Map<number, Slot>();
  #serial = 0;

  constructor(instrument: Instrument, count: number = DEFAULT_POLYPHONY) {
    for (let i = 0; i < count; i++) {
      this.#slots.push({ voice: instrument.createVoice(), pitch: -1, serial: 0 });
    }
  }

  /** Voices currently producing sound, including those still releasing. */
  get activeCount(): number {
    let n = 0;
    for (const slot of this.#slots) if (slot.voice.active) n++;
    return n;
  }

  noteOn(pitch: number, velocity = 100): void {
    // Same pitch pressed again while still sounding: release the old voice and
    // start a fresh one. Both coexist briefly, which is what real synths do.
    const existing = this.#byPitch.get(pitch);
    if (existing) {
      existing.voice.noteOff();
      this.#byPitch.delete(pitch);
    }

    const slot = this.#allocate();
    slot.voice.noteOn(pitch, velocity);
    slot.pitch = pitch;
    slot.serial = ++this.#serial;
    this.#byPitch.set(pitch, slot);
  }

  noteOff(pitch: number): void {
    const slot = this.#byPitch.get(pitch);
    if (!slot) return;
    slot.voice.noteOff();
    this.#byPitch.delete(pitch);
  }

  /** Release everything. Used on shutdown and panic. */
  allNotesOff(): void {
    for (const slot of this.#slots) slot.voice.noteOff();
    this.#byPitch.clear();
  }

  render(out: Float32Array, offset: number, count: number): void {
    for (const slot of this.#slots) {
      if (slot.voice.active) slot.voice.render(out, offset, count);
    }
  }

  #allocate(): Slot {
    let free: Slot | undefined;
    let oldest: Slot | undefined;

    for (const slot of this.#slots) {
      if (!slot.voice.active) {
        free = slot;
        break;
      }
      if (!oldest || slot.serial < oldest.serial) oldest = slot;
    }

    if (free) return free;

    // Everything is sounding, so steal the voice that started longest ago.
    const victim = oldest ?? this.#slots[0]!;
    if (this.#byPitch.get(victim.pitch) === victim) {
      this.#byPitch.delete(victim.pitch);
    }
    return victim;
  }
}
