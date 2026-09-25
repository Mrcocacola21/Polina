export class AsyncDecodeCache<Value> {
  readonly #ready = new Map<string, Value>();
  readonly #pending = new Map<string, Promise<Value>>();
  readonly #maxEntries: number;

  constructor(maxEntries = 32) {
    this.#maxEntries = Math.max(1, maxEntries);
  }

  load(key: string, loader: () => Promise<Value>): Promise<Value> {
    const cached = this.#ready.get(key);
    if (cached !== undefined) {
      this.#ready.delete(key);
      this.#ready.set(key, cached);
      return Promise.resolve(cached);
    }
    const pending = this.#pending.get(key);
    if (pending) return pending;

    const promise = loader()
      .then((value) => {
        this.#ready.set(key, value);
        while (this.#ready.size > this.#maxEntries) {
          const oldest = this.#ready.keys().next().value as string | undefined;
          if (oldest === undefined) break;
          this.#ready.delete(oldest);
        }
        return value;
      })
      .finally(() => this.#pending.delete(key));
    this.#pending.set(key, promise);
    return promise;
  }

  clear(): void {
    this.#ready.clear();
  }

  get size(): number {
    return this.#ready.size;
  }
}
