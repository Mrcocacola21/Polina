import type { PreloadPriority, QueueSnapshot } from "./types";

const PRIORITY_VALUE: Readonly<Record<PreloadPriority, number>> = {
  critical: 0,
  high: 1,
  background: 2,
};

type QueueEntry = {
  order: number;
  priority: number;
  run: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

export class PreloadQueue {
  readonly #concurrency: number;
  readonly #onChange: () => void;
  #active = 0;
  #order = 0;
  #entries: QueueEntry[] = [];

  constructor(concurrency: number, onChange: () => void = () => undefined) {
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new Error("Preload concurrency must be a positive integer.");
    }
    this.#concurrency = concurrency;
    this.#onChange = onChange;
  }

  enqueue<T>(task: () => Promise<T>, priority: PreloadPriority): Promise<T> {
    const promise = new Promise<T>((resolve, reject) => {
      this.#entries.push({
        order: this.#order,
        priority: PRIORITY_VALUE[priority],
        run: task,
        resolve: (value) => resolve(value as T),
        reject,
      });
      this.#order += 1;
      this.#entries.sort(
        (left, right) =>
          left.priority - right.priority || left.order - right.order,
      );
    });

    this.#onChange();
    this.#drain();
    return promise;
  }

  getSnapshot(): QueueSnapshot {
    return {
      queued: this.#entries.length,
      active: this.#active,
      concurrency: this.#concurrency,
    };
  }

  #drain(): void {
    while (this.#active < this.#concurrency && this.#entries.length > 0) {
      const entry = this.#entries.shift();
      if (!entry) return;
      this.#active += 1;
      this.#onChange();

      void entry
        .run()
        .then(entry.resolve, entry.reject)
        .finally(() => {
          this.#active -= 1;
          this.#onChange();
          this.#drain();
        });
    }
  }
}
