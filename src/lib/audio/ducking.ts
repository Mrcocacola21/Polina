import type { AudioBusName } from "./types";

export type DuckEntry = Readonly<{
  id: string;
  bus: AudioBusName;
  to: number;
}>;

export class DuckRegistry {
  readonly #entries = new Map<string, DuckEntry>();

  add(entry: DuckEntry): void {
    this.#entries.set(entry.id, entry);
  }

  remove(id: string): DuckEntry | undefined {
    const entry = this.#entries.get(id);
    this.#entries.delete(id);
    return entry;
  }

  has(id: string): boolean {
    return this.#entries.has(id);
  }

  getTarget(bus: AudioBusName): number {
    let target = 1;
    for (const entry of this.#entries.values()) {
      if (entry.bus === bus) target = Math.min(target, entry.to);
    }
    return target;
  }

  get size(): number {
    return this.#entries.size;
  }
}
