import type { SceneId } from "@/lib/cinematic/scenes";

import planData from "./preload-plan.json";
import type { MediaCatalog } from "./catalog";
import type { MediaAsset, PreloadPriority } from "./types";

export const PRELOAD_GROUP_IDS = [
  "BOOT_CRITICAL",
  "AFTER_OPEN_SOUL",
  "DURING_S03",
  "DURING_S07",
  "BEFORE_REQUIEM",
  "BEFORE_FINAL",
] as const;

export type PreloadGroupId = (typeof PRELOAD_GROUP_IDS)[number];
export type ResolvedPreloadPlan = Readonly<
  Record<PreloadGroupId, readonly MediaAsset[]>
>;

export const PRELOAD_GROUP_PRIORITY: Readonly<
  Record<PreloadGroupId, PreloadPriority>
> = {
  BOOT_CRITICAL: "critical",
  AFTER_OPEN_SOUL: "high",
  DURING_S03: "background",
  DURING_S07: "background",
  BEFORE_REQUIEM: "background",
  BEFORE_FINAL: "background",
};

const SCENE_PRELOAD_DEPENDENCY: Readonly<Record<SceneId, PreloadGroupId>> = {
  PRELOADER: "BOOT_CRITICAL",
  PROLOGUE: "BOOT_CRITICAL",
  S01: "BOOT_CRITICAL",
  S02: "AFTER_OPEN_SOUL",
  S03: "AFTER_OPEN_SOUL",
  S04: "AFTER_OPEN_SOUL",
  S05: "AFTER_OPEN_SOUL",
  S06: "DURING_S03",
  S07: "DURING_S03",
  S08: "DURING_S03",
  S09: "DURING_S07",
  S10: "DURING_S07",
  PRE_FINAL: "BEFORE_REQUIEM",
  SOULS_RELEASE: "BEFORE_REQUIEM",
  REQUIEM: "BEFORE_REQUIEM",
  SILENCE: "BEFORE_FINAL",
  FINAL: "BEFORE_FINAL",
};

export function getPreloadGroupRefs(
  groupId: PreloadGroupId,
): readonly string[] {
  return planData[groupId];
}

export function getPreloadGroupForScene(sceneId: SceneId): PreloadGroupId {
  return SCENE_PRELOAD_DEPENDENCY[sceneId];
}

export function resolvePreloadPlan(catalog: MediaCatalog): ResolvedPreloadPlan {
  return Object.fromEntries(
    PRELOAD_GROUP_IDS.map((groupId) => {
      const assets = getPreloadGroupRefs(groupId).map((semanticRef) =>
        catalog.getBySemanticRef(semanticRef),
      );
      const uniqueIds = new Set(assets.map((asset) => asset.id));

      if (uniqueIds.size !== assets.length) {
        throw new Error(`Preload group ${groupId} contains duplicate media.`);
      }

      return [groupId, Object.freeze(assets)];
    }),
  ) as Record<PreloadGroupId, readonly MediaAsset[]>;
}
