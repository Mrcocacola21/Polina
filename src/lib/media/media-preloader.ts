import type { SceneId } from "@/lib/cinematic/scenes";

import { MediaCache } from "./cache";
import { loadMediaCatalog, type MediaCatalog } from "./catalog";
import {
  getPreloadGroupForScene,
  PRELOAD_GROUP_IDS,
  PRELOAD_GROUP_PRIORITY,
  resolvePreloadPlan,
  type PreloadGroupId,
  type ResolvedPreloadPlan,
} from "./preload-plan";
import { PreloadQueue } from "./preload-queue";
import { DEFAULT_MEDIA_LOADERS, toMediaFailure } from "./preloaders";
import type {
  MediaAsset,
  MediaCacheSnapshot,
  MediaDiagnostics,
  MediaLoadResult,
  MediaLoaders,
  PreloadGroupProgress,
  PreloadPriority,
} from "./types";

export const DEFAULT_PRELOAD_CONCURRENCY = 5;

type PreloadOptions = Readonly<{
  priority?: PreloadPriority;
  retryFailed?: boolean;
}>;

export class MediaPreloader {
  readonly #catalog: MediaCatalog;
  readonly #plan: ResolvedPreloadPlan;
  readonly #loaders: MediaLoaders;
  readonly #cache = new MediaCache();
  readonly #queue: PreloadQueue;
  readonly #listeners = new Set<() => void>();
  readonly #requestedGroups = new Set<PreloadGroupId>();
  readonly #groupPromises = new Map<
    PreloadGroupId,
    Promise<PreloadGroupProgress<PreloadGroupId>>
  >();
  #revision = 0;

  constructor(
    catalog: MediaCatalog,
    plan: ResolvedPreloadPlan,
    options: Readonly<{
      concurrency?: number;
      loaders?: MediaLoaders;
    }> = {},
  ) {
    this.#catalog = catalog;
    this.#plan = plan;
    this.#loaders = options.loaders ?? DEFAULT_MEDIA_LOADERS;
    this.#queue = new PreloadQueue(
      options.concurrency ?? DEFAULT_PRELOAD_CONCURRENCY,
      () => this.#notify(),
    );
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getRevision = (): number => this.#revision;

  preload(asset: MediaAsset, options: PreloadOptions = {}): Promise<MediaLoadResult> {
    const cached = this.#cache.get(asset);

    if (cached?.status === "loading" && cached.promise) {
      return cached.promise;
    }

    if (cached?.status === "ready") {
      return Promise.resolve({ asset, status: "ready" });
    }

    if (cached?.status === "failed" && !options.retryFailed) {
      return Promise.resolve({
        asset,
        status: "failed",
        error: cached.error,
      });
    }

    const loadPromise = this.#queue
      .enqueue(
        () => this.#loaders[asset.kind](asset),
        options.priority ?? "background",
      )
      .then(
        (): MediaLoadResult => {
          this.#cache.markReady(asset);
          this.#notify();
          return { asset, status: "ready" };
        },
        (error: unknown): MediaLoadResult => {
          const failure = toMediaFailure(error);
          this.#cache.markFailed(asset, failure);
          this.#notify();
          return { asset, status: "failed", error: failure };
        },
      );

    this.#cache.markLoading(asset, loadPromise);
    this.#notify();
    return loadPromise;
  }

  preloadGroup(
    groupId: PreloadGroupId,
    priority: PreloadPriority = PRELOAD_GROUP_PRIORITY[groupId],
  ): Promise<PreloadGroupProgress<PreloadGroupId>> {
    const existing = this.#groupPromises.get(groupId);
    if (existing) return existing;

    this.#requestedGroups.add(groupId);
    this.#notify();
    const promise = Promise.all(
      this.#plan[groupId].map((asset) => this.preload(asset, { priority })),
    ).then(() => this.getGroupProgress(groupId));
    this.#groupPromises.set(groupId, promise);
    return promise;
  }

  ensureSceneMedia(sceneId: SceneId): Promise<PreloadGroupProgress<PreloadGroupId>> {
    return this.preloadGroup(getPreloadGroupForScene(sceneId), "high");
  }

  retry(asset: MediaAsset): Promise<MediaLoadResult> {
    const cached = this.#cache.get(asset);
    if (
      cached?.status !== "failed" ||
      !cached.error?.retryable
    ) {
      return this.preload(asset);
    }

    this.#cache.reset(asset);
    this.#notify();
    return this.preload(asset, { priority: "high", retryFailed: true });
  }

  async retryFailed(): Promise<number> {
    const failures = this.#cache
      .getAllSnapshots()
      .filter((entry) => entry.status === "failed" && entry.error?.retryable);
    await Promise.all(failures.map((entry) => this.retry(entry.asset)));
    return failures.length;
  }

  getAssetStatus(asset: MediaAsset): MediaCacheSnapshot {
    return this.#cache.getSnapshot(asset);
  }

  isReady(asset: MediaAsset): boolean {
    return this.#cache.get(asset)?.status === "ready";
  }

  getGroupProgress(
    groupId: PreloadGroupId,
  ): PreloadGroupProgress<PreloadGroupId> {
    const assets = this.#plan[groupId];
    let ready = 0;
    let failed = 0;

    for (const asset of assets) {
      const status = this.#cache.get(asset)?.status ?? "idle";
      if (status === "ready") ready += 1;
      else if (status === "failed") failed += 1;
    }

    const completed = ready + failed;
    const total = assets.length;
    const requested = this.#requestedGroups.has(groupId);
    const state = !requested
      ? "idle"
      : completed < total
        ? "loading"
        : failed > 0
          ? "ready-with-errors"
          : "ready";

    return {
      groupId,
      state,
      total,
      completed,
      ready,
      failed,
      percentage: total === 0 ? 100 : Number(((completed / total) * 100).toFixed(2)),
    };
  }

  getDiagnostics(): MediaDiagnostics<PreloadGroupId> {
    const groups = Object.fromEntries(
      PRELOAD_GROUP_IDS.map((groupId) => [
        groupId,
        this.getGroupProgress(groupId),
      ]),
    ) as Record<PreloadGroupId, PreloadGroupProgress<PreloadGroupId>>;
    const entries = this.#cache.getAllSnapshots();

    return {
      groups,
      queue: this.#queue.getSnapshot(),
      cachedAssets: this.#cache.size,
      failures: entries.filter((entry) => entry.status === "failed"),
    };
  }

  getCatalog(): MediaCatalog {
    return this.#catalog;
  }

  #notify(): void {
    this.#revision += 1;
    this.#listeners.forEach((listener) => listener());
  }
}

let preloaderPromise: Promise<MediaPreloader> | undefined;

export function getMediaPreloader(): Promise<MediaPreloader> {
  preloaderPromise ??= loadMediaCatalog().then(
    (catalog) => new MediaPreloader(catalog, resolvePreloadPlan(catalog)),
  );
  return preloaderPromise;
}

export async function startAfterOpenSoulPrefetch(): Promise<
  PreloadGroupProgress<PreloadGroupId>
> {
  return (await getMediaPreloader()).preloadGroup("AFTER_OPEN_SOUL");
}

export async function startMediaGroup(
  groupId: PreloadGroupId,
): Promise<PreloadGroupProgress<PreloadGroupId>> {
  return (await getMediaPreloader()).preloadGroup(groupId);
}

export async function requestMediaForScene(
  sceneId: SceneId,
): Promise<PreloadGroupProgress<PreloadGroupId>> {
  return (await getMediaPreloader()).ensureSceneMedia(sceneId);
}
