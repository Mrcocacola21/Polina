import type { SceneId } from "@/lib/cinematic/scenes";

import rawRegistry from "./soul-registry.json";

export type SoulNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type SoulId =
  | "SOUL_01"
  | "SOUL_02"
  | "SOUL_03"
  | "SOUL_04"
  | "SOUL_05"
  | "SOUL_06"
  | "SOUL_07"
  | "SOUL_08"
  | "SOUL_09"
  | "SOUL_10";
export type CollectibleSceneId =
  | "S01"
  | "S02"
  | "S03"
  | "S04"
  | "S05"
  | "S06"
  | "S07"
  | "S08"
  | "S09"
  | "S10";

export type SoulDefinition = Readonly<{
  soulId: SoulId;
  sceneId: CollectibleSceneId;
  slotIndex: SoulNumber;
}>;

export const SOUL_REGISTRY = Object.freeze(
  rawRegistry.map((entry) => Object.freeze(entry as SoulDefinition)),
) as readonly SoulDefinition[];

export const SOUL_IDS = Object.freeze(
  SOUL_REGISTRY.map((definition) => definition.soulId),
) as readonly SoulId[];

const bySoulId = new Map(
  SOUL_REGISTRY.map((definition) => [definition.soulId, definition]),
);
const bySceneId = new Map(
  SOUL_REGISTRY.map((definition) => [definition.sceneId, definition]),
);

export function getSoulDefinition(soulId: SoulId): SoulDefinition {
  const definition = bySoulId.get(soulId);
  if (!definition) throw new Error(`Unknown collectible Soul: ${soulId}`);
  return definition;
}

export function getSoulForScene(sceneId: SceneId): SoulDefinition | undefined {
  return bySceneId.get(sceneId as CollectibleSceneId);
}

export function isSoulId(value: unknown): value is SoulId {
  return typeof value === "string" && bySoulId.has(value as SoulId);
}

