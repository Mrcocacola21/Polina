"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCENE_COUNT = exports.SCENE_REGISTRY = exports.SCENE_IDS = void 0;
exports.isSceneId = isSceneId;
exports.getSceneById = getSceneById;
exports.getSceneIndex = getSceneIndex;
exports.getPreviousScene = getPreviousScene;
exports.getNextScene = getNextScene;
exports.SCENE_IDS = [
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
];
const SCENE_TITLES = {
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
exports.SCENE_REGISTRY = Object.freeze(exports.SCENE_IDS.map((id) => Object.freeze({ id, title: SCENE_TITLES[id] })));
exports.SCENE_COUNT = exports.SCENE_REGISTRY.length;
const sceneIdSet = new Set(exports.SCENE_IDS);
const sceneById = new Map(exports.SCENE_REGISTRY.map((scene) => [scene.id, scene]));
function assertSceneRegistry() {
    const registryIds = exports.SCENE_REGISTRY.map((scene) => scene.id);
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
    if (registryIds.length !== exports.SCENE_IDS.length ||
        registryIds.some((id, index) => id !== exports.SCENE_IDS[index])) {
        throw new Error("SOULBOUND scene registry must contain every canonical scene exactly once and in canonical order.");
    }
}
if (process.env.NODE_ENV !== "production") {
    assertSceneRegistry();
}
function isSceneId(value) {
    return typeof value === "string" && sceneIdSet.has(value);
}
function getSceneById(sceneId) {
    const scene = sceneById.get(sceneId);
    if (!scene) {
        throw new Error(`Unknown SOULBOUND scene: ${sceneId}`);
    }
    return scene;
}
function getSceneIndex(sceneId) {
    return exports.SCENE_IDS.indexOf(sceneId);
}
function getPreviousScene(sceneId) {
    const previousIndex = getSceneIndex(sceneId) - 1;
    return previousIndex >= 0 ? exports.SCENE_REGISTRY[previousIndex] : undefined;
}
function getNextScene(sceneId) {
    return exports.SCENE_REGISTRY[getSceneIndex(sceneId) + 1];
}
