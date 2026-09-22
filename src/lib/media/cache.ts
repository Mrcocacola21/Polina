import type {
  MediaAsset,
  MediaCacheSnapshot,
  MediaFailure,
  MediaLoadResult,
} from "./types";

type MutableCacheEntry = {
  asset: MediaAsset;
  status: MediaCacheSnapshot["status"];
  promise?: Promise<MediaLoadResult>;
  error?: MediaFailure;
  startedAt?: number;
  completedAt?: number;
};

export class MediaCache {
  readonly #entries = new Map<string, MutableCacheEntry>();

  ensure(asset: MediaAsset): MutableCacheEntry {
    const existing = this.#entries.get(asset.id);
    if (existing) return existing;

    const entry: MutableCacheEntry = { asset, status: "idle" };
    this.#entries.set(asset.id, entry);
    return entry;
  }

  markLoading(
    asset: MediaAsset,
    promise: Promise<MediaLoadResult>,
  ): MutableCacheEntry {
    const entry = this.ensure(asset);
    entry.status = "loading";
    entry.promise = promise;
    entry.error = undefined;
    entry.startedAt = Date.now();
    entry.completedAt = undefined;
    return entry;
  }

  markReady(asset: MediaAsset): void {
    const entry = this.ensure(asset);
    entry.status = "ready";
    entry.promise = undefined;
    entry.error = undefined;
    entry.completedAt = Date.now();
  }

  markFailed(asset: MediaAsset, error: MediaFailure): void {
    const entry = this.ensure(asset);
    entry.status = "failed";
    entry.promise = undefined;
    entry.error = error;
    entry.completedAt = Date.now();
  }

  reset(asset: MediaAsset): void {
    this.#entries.set(asset.id, { asset, status: "idle" });
  }

  get(asset: MediaAsset): MutableCacheEntry | undefined {
    return this.#entries.get(asset.id);
  }

  getSnapshot(asset: MediaAsset): MediaCacheSnapshot {
    const entry = this.ensure(asset);
    return {
      asset: entry.asset,
      status: entry.status,
      error: entry.error,
      startedAt: entry.startedAt,
      completedAt: entry.completedAt,
    };
  }

  getAllSnapshots(): readonly MediaCacheSnapshot[] {
    return [...this.#entries.values()].map((entry) => ({
      asset: entry.asset,
      status: entry.status,
      error: entry.error,
      startedAt: entry.startedAt,
      completedAt: entry.completedAt,
    }));
  }

  get size(): number {
    return this.#entries.size;
  }
}
