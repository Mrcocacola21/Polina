export class AsyncDecodeCache<Value> {
  readonly #ready = new Map<string, Value>();
  readonly #pending = new Map<string, Promise<Value>>();

  load(key: string, loader: () => Promise<Value>): Promise<Value> {
    const cached = this.#ready.get(key);
    if (cached !== undefined) return Promise.resolve(cached);
    const pending = this.#pending.get(key);
    if (pending) return pending;

    const promise = loader()
      .then((value) => {
        this.#ready.set(key, value);
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
