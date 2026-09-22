export const SCENE_IDS = [
  "PRELOADER",
  "PROLOGUE",
  "S01",
  "S02",
  "S03",
  "S04",
  "S05",
  "S06",
  "S07",
  "S08",
  "S09",
  "S10",
  "PRE_FINAL",
  "SOULS_RELEASE",
  "REQUIEM",
  "SILENCE",
  "FINAL",
] as const;

export type SceneId = (typeof SCENE_IDS)[number];

export type SceneDefinition = Readonly<{
  id: SceneId;
  title: string;
}>;

const SCENE_TITLES: Readonly<Record<SceneId, string>> = {
  PRELOADER: "Preloader",
  PROLOGUE: "Prologue",
  S01: "Discord / Calm",
  S02: "Notification",
  S03: "Shared Moments",
  S04: "Miss You",
  S05: "Good Morning",
  S06: "Heart Reaction",
  S07: "Admiration",
  S08: "Queen",
  S09: "Pain / Care",
  S10: "Anxiety",
  PRE_FINAL: "Vulnerability",
  SOULS_RELEASE: "Souls Released",
  REQUIEM: "Requiem",
  SILENCE: "Silence",
  FINAL: "Final Confession",
};

export const SCENE_REGISTRY: readonly SceneDefinition[] = Object.freeze(
  SCENE_IDS.map((id) => Object.freeze({ id, title: SCENE_TITLES[id] })),
);

export const SCENE_COUNT = SCENE_REGISTRY.length;

const sceneIdSet: ReadonlySet<string> = new Set(SCENE_IDS);
const sceneById = new Map<SceneId, SceneDefinition>(
  SCENE_REGISTRY.map((scene) => [scene.id, scene]),
);

function assertSceneRegistry(): void {
  const registryIds = SCENE_REGISTRY.map((scene) => scene.id);
  const uniqueIds = new Set(registryIds);

  if (uniqueIds.size !== registryIds.length) {
    throw new Error("SOULBOUND scene registry contains duplicate IDs.");
  }

  if (registryIds[0] !== "PRELOADER") {
    throw new Error("SOULBOUND scene registry must start with PRELOADER.");
  }

  if (registryIds.at(-1) !== "FINAL") {
    throw new Error("SOULBOUND scene registry must end with FINAL.");
  }

  if (
    registryIds.length !== SCENE_IDS.length ||
    registryIds.some((id, index) => id !== SCENE_IDS[index])
  ) {
    throw new Error(
      "SOULBOUND scene registry must contain every canonical scene exactly once and in canonical order.",
    );
  }
}

if (process.env.NODE_ENV !== "production") {
  assertSceneRegistry();
}

export function isSceneId(value: unknown): value is SceneId {
  return typeof value === "string" && sceneIdSet.has(value);
}

export function getSceneById(sceneId: SceneId): SceneDefinition {
  const scene = sceneById.get(sceneId);

  if (!scene) {
    throw new Error(`Unknown SOULBOUND scene: ${sceneId}`);
  }

  return scene;
}

export function getSceneIndex(sceneId: SceneId): number {
  return SCENE_IDS.indexOf(sceneId);
}

export function getPreviousScene(
  sceneId: SceneId,
): SceneDefinition | undefined {
  const previousIndex = getSceneIndex(sceneId) - 1;
  return previousIndex >= 0 ? SCENE_REGISTRY[previousIndex] : undefined;
}

export function getNextScene(sceneId: SceneId): SceneDefinition | undefined {
  return SCENE_REGISTRY[getSceneIndex(sceneId) + 1];
}
