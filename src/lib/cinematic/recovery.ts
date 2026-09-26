import { isSceneId, type SceneId } from "./scenes";
import { SOUL_IDS, type SoulId } from "../souls/registry";

export const RECOVERY_STORAGE_KEY = "soulbound.recovery.v1";
export const RECOVERY_VERSION = 1 as const;
export const RECOVERY_MAX_AGE_MS = 8 * 60 * 60 * 1000;

export type RecoveryCheckpoint =
  | "PROLOGUE_WAITING_OPEN"
  | `${`S0${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}` | "S10"}_${"START" | "COLLECTED"}`
  | "PRE_FINAL"
  | "SILENCE_START"
  | "FINAL_START"
  | "FINAL_QUESTION";

export type RecoveryRecord = Readonly<{
  version: typeof RECOVERY_VERSION;
  sceneId: SceneId;
  checkpoint: RecoveryCheckpoint;
  collectedSoulIds: readonly SoulId[];
  updatedAt: string;
}>;

export type RecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type StartupRecovery = Readonly<{
  sceneId: SceneId;
  collectedSoulIds: readonly SoulId[];
  source: "answer" | "recovery" | "fresh";
}>;

const SOUL_SCENES = new Set<SceneId>(["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10"]);

export function checkpointFor(sceneId: SceneId, soulCount: number): RecoveryCheckpoint {
  if (sceneId === "PROLOGUE") return "PROLOGUE_WAITING_OPEN";
  if (SOUL_SCENES.has(sceneId)) {
    return `${sceneId}_${soulCount >= Number(sceneId.slice(1)) ? "COLLECTED" : "START"}` as RecoveryCheckpoint;
  }
  if (sceneId === "SILENCE") return "SILENCE_START";
  if (sceneId === "FINAL") return "FINAL_START";
  return "PRE_FINAL";
}

export function safeRecoveryScene(sceneId: SceneId): SceneId {
  if (sceneId === "REQUIEM" || sceneId === "SOULS_RELEASE") return "PRE_FINAL";
  if (sceneId === "PRELOADER") return "PROLOGUE";
  return sceneId;
}

function validSoulPrefix(value: unknown): value is readonly SoulId[] {
  if (!Array.isArray(value) || value.length > SOUL_IDS.length) return false;
  return value.every((id, index) => id === SOUL_IDS[index]);
}

function maxSoulsForScene(sceneId: SceneId): number {
  if (sceneId.startsWith("S") && /^S\d\d$/.test(sceneId)) return Number(sceneId.slice(1));
  if (["PRE_FINAL", "SOULS_RELEASE", "REQUIEM", "SILENCE", "FINAL"].includes(sceneId)) return 10;
  return 0;
}

export function createRecoveryRecord(
  sceneId: SceneId,
  collectedSoulIds: readonly SoulId[],
  now = new Date(),
  checkpoint = checkpointFor(sceneId, collectedSoulIds.length),
): RecoveryRecord {
  const safeScene = safeRecoveryScene(sceneId);
  return {
    version: RECOVERY_VERSION,
    sceneId: safeScene,
    checkpoint: safeScene === sceneId ? checkpoint : "PRE_FINAL",
    collectedSoulIds: [...collectedSoulIds],
    updatedAt: now.toISOString(),
  };
}

export function parseRecoveryRecord(value: string | null, now = Date.now()): RecoveryRecord | null {
  if (!value) return null;
  try {
    const candidate: unknown = JSON.parse(value);
    if (!candidate || typeof candidate !== "object") return null;
    const record = candidate as Record<string, unknown>;
    if (record.version !== RECOVERY_VERSION || !isSceneId(record.sceneId)) return null;
    if (typeof record.checkpoint !== "string" || typeof record.updatedAt !== "string") return null;
    const timestamp = Date.parse(record.updatedAt);
    if (!Number.isFinite(timestamp) || timestamp > now + 60_000 || now - timestamp > RECOVERY_MAX_AGE_MS) return null;
    if (!validSoulPrefix(record.collectedSoulIds)) return null;
    const sceneId = safeRecoveryScene(record.sceneId);
    if (record.collectedSoulIds.length > maxSoulsForScene(sceneId)) return null;
    if (["PRE_FINAL", "SILENCE", "FINAL"].includes(sceneId) && record.collectedSoulIds.length !== 10) return null;
    const expectedCheckpoint = checkpointFor(sceneId, record.collectedSoulIds.length);
    const checkpoint = record.checkpoint === "FINAL_QUESTION" && sceneId === "FINAL"
      ? "FINAL_QUESTION"
      : expectedCheckpoint;
    return {
      version: RECOVERY_VERSION,
      sceneId,
      checkpoint,
      collectedSoulIds: [...record.collectedSoulIds],
      updatedAt: new Date(timestamp).toISOString(),
    };
  } catch {
    return null;
  }
}

export function readRecovery(storage: RecoveryStorage, now = Date.now()): RecoveryRecord | null {
  try {
    const record = parseRecoveryRecord(storage.getItem(RECOVERY_STORAGE_KEY), now);
    if (!record) storage.removeItem(RECOVERY_STORAGE_KEY);
    return record;
  } catch {
    return null;
  }
}

export function persistRecovery(storage: RecoveryStorage, record: RecoveryRecord): boolean {
  try {
    storage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function clearRecovery(storage: RecoveryStorage): boolean {
  try {
    storage.removeItem(RECOVERY_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function resolveStartupRecovery(
  hasCompletedAnswer: boolean,
  recovery: RecoveryRecord | null,
): StartupRecovery {
  if (hasCompletedAnswer) return { sceneId: "FINAL", collectedSoulIds: SOUL_IDS, source: "answer" };
  if (recovery) return { sceneId: recovery.sceneId, collectedSoulIds: recovery.collectedSoulIds, source: "recovery" };
  return { sceneId: "PRELOADER", collectedSoulIds: [], source: "fresh" };
}
