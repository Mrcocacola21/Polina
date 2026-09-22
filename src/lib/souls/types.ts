import type { SceneId } from "@/lib/cinematic/scenes";
import type { SoulState } from "@/lib/visuals/types";

import type { SoulId, SoulNumber } from "./registry";

export type CollectionVariant = "NORMAL" | "SILENT" | "DEEP";
export type SoulVoice = "NONE" | "A" | "B" | "C";
export type SoulSlotStatus = "EMPTY" | "COLLECTING" | "COLLECTED" | "RELEASED";
export type SoulHudMode = "VISIBLE" | "DIMMED" | "HIDDEN";
export type SoulReleaseState = "IDLE" | "RELEASING" | "RELEASED";

export type SoulSlot = Readonly<{
  soulId: SoulId;
  sceneId: SceneId;
  slotIndex: SoulNumber;
  status: SoulSlotStatus;
  collectedAt?: number;
  variant?: CollectionVariant;
  visualState?: SoulState;
}>;

export type SoulCollectionState = Readonly<{
  slots: readonly SoulSlot[];
  activeSoulId: SoulId | null;
  hudMode: SoulHudMode;
  releaseState: SoulReleaseState;
}>;

export type CollectionSource =
  | Readonly<{
      type: "TEXT";
      element: HTMLElement;
      convergence?: readonly [number, number];
    }>
  | Readonly<{
      type: "POINT";
      point: readonly [number, number];
    }>;

export type CollectionTiming = Readonly<{
  glow: number;
  fragment: number;
  gather: number;
  spawn: number;
  stabilize: number;
  flight: number;
  absorb: number;
}>;

export type CollectSoulOptions = Readonly<{
  soulId: SoulId;
  source: CollectionSource;
  variant?: CollectionVariant;
  voice?: SoulVoice;
  visualState?: SoulState;
  restoreSourceAfterCollection?: boolean;
  convergence?: readonly [number, number];
  timing?: Partial<CollectionTiming>;
  timingScale?: number;
  owner?: Readonly<{ sceneId: SceneId; runId: number }>;
}>;

export type CollectionResultStatus =
  | "collected"
  | "already-collected"
  | "in-progress"
  | "busy"
  | "cancelled"
  | "failed";

export type CollectionResult = Readonly<{
  status: CollectionResultStatus;
  soulId: SoulId;
  count: number;
  reason?: string;
}>;

export type ReleaseResult = Readonly<{
  status: "released" | "already-released" | "incomplete" | "busy" | "failed";
  count: number;
  releasedCount: number;
}>;

