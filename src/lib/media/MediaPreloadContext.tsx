"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { SceneId } from "@/lib/cinematic/scenes";
import type { ScenePhase } from "@/lib/cinematic/types";

import {
  getMediaPreloader,
  startAfterOpenSoulPrefetch,
  startMediaGroup,
  type MediaPreloader,
} from "./media-preloader";
import {
  getPreloadGroupRefs,
  PRELOAD_GROUP_IDS,
  type PreloadGroupId,
} from "./preload-plan";
import type {
  MediaAsset,
  MediaCacheSnapshot,
  MediaDiagnostics,
  PreloadGroupProgress,
} from "./types";

type MediaPreloadContextValue = Readonly<{
  service: MediaPreloader | null;
  initializationError: Error | null;
}>;

const MediaPreloadContext = createContext<MediaPreloadContextValue | null>(null);
const subscribeToNothing = () => () => undefined;
const getZeroRevision = () => 0;

function idleGroupProgress(
  groupId: PreloadGroupId,
): PreloadGroupProgress<PreloadGroupId> {
  return {
    groupId,
    state: "idle",
    total: getPreloadGroupRefs(groupId).length,
    completed: 0,
    ready: 0,
    failed: 0,
    percentage: 0,
  };
}

function failedBootProgress(): PreloadGroupProgress<PreloadGroupId> {
  const total = getPreloadGroupRefs("BOOT_CRITICAL").length;
  return {
    groupId: "BOOT_CRITICAL",
    state: "ready-with-errors",
    total,
    completed: total,
    ready: 0,
    failed: total,
    percentage: 100,
  };
}

function useServiceRevision(service: MediaPreloader | null): number {
  return useSyncExternalStore(
    service?.subscribe ?? subscribeToNothing,
    service?.getRevision ?? getZeroRevision,
    getZeroRevision,
  );
}

export function MediaPreloadProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [value, setValue] = useState<MediaPreloadContextValue>({
    service: null,
    initializationError: null,
  });

  useEffect(() => {
    let mounted = true;

    void getMediaPreloader().then(
      (service) => {
        void service.preloadGroup("BOOT_CRITICAL");
        if (mounted) {
          setValue({ service, initializationError: null });
        }
      },
      (error: unknown) => {
        if (mounted) {
          setValue({
            service: null,
            initializationError:
              error instanceof Error
                ? error
                : new Error("Media infrastructure failed to initialize."),
          });
        }
      },
    );

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <MediaPreloadContext.Provider value={value}>
      {children}
    </MediaPreloadContext.Provider>
  );
}

function useMediaPreloadContext(): MediaPreloadContextValue {
  const context = useContext(MediaPreloadContext);
  if (!context) {
    throw new Error("Media preload hooks require MediaPreloadProvider.");
  }
  return context;
}

export function usePreloadProgress(
  groupId: PreloadGroupId,
): PreloadGroupProgress<PreloadGroupId> {
  const { service, initializationError } = useMediaPreloadContext();
  useServiceRevision(service);

  if (service) return service.getGroupProgress(groupId);
  if (initializationError && groupId === "BOOT_CRITICAL") {
    return failedBootProgress();
  }
  return idleGroupProgress(groupId);
}

export function usePreloadGroup(
  groupId: PreloadGroupId,
  start = false,
): PreloadGroupProgress<PreloadGroupId> {
  const { service } = useMediaPreloadContext();

  useEffect(() => {
    if (start && service) void service.preloadGroup(groupId);
  }, [groupId, service, start]);

  return usePreloadProgress(groupId);
}

export function useMediaStatus(asset: MediaAsset): MediaCacheSnapshot {
  const { service } = useMediaPreloadContext();
  useServiceRevision(service);

  return service?.getAssetStatus(asset) ?? { asset, status: "idle" };
}

export function useMediaAsset(
  semanticRef: string,
): MediaAsset | null {
  const { service } = useMediaPreloadContext();
  useServiceRevision(service);

  if (!service) return null;

  try {
    return service.getCatalog().getBySemanticRef(semanticRef);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(`Unable to resolve media asset ${semanticRef}.`, error);
    }
    return null;
  }
}

export function useMediaDiagnostics(): MediaDiagnostics<PreloadGroupId> {
  const { service, initializationError } = useMediaPreloadContext();
  useServiceRevision(service);

  if (service) return service.getDiagnostics();

  const groups = Object.fromEntries(
    PRELOAD_GROUP_IDS.map((groupId) => [
      groupId,
      initializationError && groupId === "BOOT_CRITICAL"
        ? failedBootProgress()
        : idleGroupProgress(groupId),
    ]),
  ) as Record<PreloadGroupId, PreloadGroupProgress<PreloadGroupId>>;

  return {
    groups,
    queue: { queued: 0, active: 0, concurrency: 3 },
    cachedAssets: 0,
    failures: [],
  };
}

export function useMediaPreloadActions() {
  const { service } = useMediaPreloadContext();

  const preloadGroup = useCallback(
    (groupId: PreloadGroupId) =>
      service ? service.preloadGroup(groupId) : startMediaGroup(groupId),
    [service],
  );

  const startAfterOpenSoul = useCallback(
    () =>
      service
        ? service.preloadGroup("AFTER_OPEN_SOUL")
        : startAfterOpenSoulPrefetch(),
    [service],
  );

  const retryFailed = useCallback(
    async () => (service ?? (await getMediaPreloader())).retryFailed(),
    [service],
  );

  return useMemo(
    () => ({ preloadGroup, startAfterOpenSoul, retryFailed }),
    [preloadGroup, retryFailed, startAfterOpenSoul],
  );
}

export function useProgressiveMediaPrefetch(
  sceneId: SceneId,
  phase: ScenePhase,
): void {
  const { preloadGroup } = useMediaPreloadActions();

  useEffect(() => {
    if (phase !== "active") return;

    if (sceneId === "S03") {
      void preloadGroup("DURING_S03");
    } else if (sceneId === "S07") {
      void preloadGroup("DURING_S07");
      void preloadGroup("BEFORE_REQUIEM");
    } else if (sceneId === "S09") {
      void preloadGroup("BEFORE_FINAL");
    }
  }, [phase, preloadGroup, sceneId]);
}
