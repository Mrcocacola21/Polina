export type MediaKind = "image" | "video" | "audio";

export type MediaAsset = Readonly<{
  id: string;
  relativePath: string;
  url: string;
  masterUrl: string;
  kind: MediaKind;
  delivery: "master" | "optimized";
  deliveryProfile?: "default" | "mobile";
  usage?: "buffer" | "stream";
  mimeType?: string;
  semanticRefs: readonly string[];
}>;

export type MediaStatus = "idle" | "loading" | "ready" | "failed";

export type MediaFailure = Readonly<{
  message: string;
  retryable: boolean;
  statusCode?: number;
}>;

export type MediaLoadResult = Readonly<{
  asset: MediaAsset;
  status: "ready" | "failed";
  error?: MediaFailure;
}>;

export type MediaCacheSnapshot = Readonly<{
  asset: MediaAsset;
  status: MediaStatus;
  error?: MediaFailure;
  startedAt?: number;
  completedAt?: number;
}>;

export type PreloadGroupState =
  | "idle"
  | "loading"
  | "ready"
  | "ready-with-errors";

export type PreloadGroupProgress<GroupId extends string = string> = Readonly<{
  groupId: GroupId;
  state: PreloadGroupState;
  total: number;
  completed: number;
  ready: number;
  failed: number;
  percentage: number;
}>;

export type PreloadPriority = "critical" | "high" | "background";

export type QueueSnapshot = Readonly<{
  queued: number;
  active: number;
  concurrency: number;
}>;

export type MediaDiagnostics<GroupId extends string = string> = Readonly<{
  groups: Readonly<Record<GroupId, PreloadGroupProgress<GroupId>>>;
  queue: QueueSnapshot;
  cachedAssets: number;
  failures: readonly MediaCacheSnapshot[];
}>;

export type MediaLoader = (asset: MediaAsset) => Promise<void>;

export type MediaLoaders = Readonly<Record<MediaKind, MediaLoader>>;
