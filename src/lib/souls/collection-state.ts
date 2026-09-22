import { SOUL_REGISTRY, type SoulId } from "./registry";
import type {
  CollectionVariant,
  SoulCollectionState,
  SoulHudMode,
  SoulSlot,
} from "./types";
import type { SoulState } from "@/lib/visuals/types";

export function createInitialSoulCollectionState(): SoulCollectionState {
  return {
    slots: SOUL_REGISTRY.map((definition) => ({
      ...definition,
      status: "EMPTY" as const,
    })),
    activeSoulId: null,
    hudMode: "VISIBLE",
    releaseState: "IDLE",
  };
}

export function deriveSoulCount(state: SoulCollectionState): number {
  return state.slots.filter(
    (slot) => slot.status === "COLLECTED" || slot.status === "RELEASED",
  ).length;
}

function replaceSlot(
  state: SoulCollectionState,
  soulId: SoulId,
  update: (slot: SoulSlot) => SoulSlot,
): SoulCollectionState {
  return {
    ...state,
    slots: state.slots.map((slot) =>
      slot.soulId === soulId ? update(slot) : slot,
    ),
  };
}

export type BeginCollectionOutcome =
  | "started"
  | "already-collected"
  | "in-progress"
  | "busy"
  | "release-locked";

export function beginSoulCollection(
  state: SoulCollectionState,
  soulId: SoulId,
): Readonly<{ state: SoulCollectionState; outcome: BeginCollectionOutcome }> {
  if (state.releaseState !== "IDLE") return { state, outcome: "release-locked" };
  const slot = state.slots.find((candidate) => candidate.soulId === soulId);
  if (!slot) throw new Error(`Unknown Soul slot: ${soulId}`);
  if (slot.status === "COLLECTED" || slot.status === "RELEASED") {
    return { state, outcome: "already-collected" };
  }
  if (state.activeSoulId === soulId) return { state, outcome: "in-progress" };
  if (state.activeSoulId) return { state, outcome: "busy" };
  return {
    outcome: "started",
    state: {
      ...replaceSlot(state, soulId, (current) => ({ ...current, status: "COLLECTING" })),
      activeSoulId: soulId,
    },
  };
}

export function commitSoulCollection(
  state: SoulCollectionState,
  soulId: SoulId,
  metadata: Readonly<{
    variant: CollectionVariant;
    visualState: SoulState;
    collectedAt: number;
  }>,
): SoulCollectionState {
  const slot = state.slots.find((candidate) => candidate.soulId === soulId);
  if (state.activeSoulId !== soulId || slot?.status !== "COLLECTING") return state;
  return {
    ...replaceSlot(state, soulId, (current) => ({
      ...current,
      status: "COLLECTED",
      ...metadata,
    })),
    activeSoulId: null,
  };
}

export function cancelSoulCollection(
  state: SoulCollectionState,
  soulId?: SoulId,
): SoulCollectionState {
  const target = soulId ?? state.activeSoulId;
  if (!target || state.activeSoulId !== target) return state;
  return {
    ...replaceSlot(state, target, (slot) => ({
      soulId: slot.soulId,
      sceneId: slot.sceneId,
      slotIndex: slot.slotIndex,
      status: "EMPTY",
    })),
    activeSoulId: null,
  };
}

export function setSoulHudMode(
  state: SoulCollectionState,
  hudMode: SoulHudMode,
): SoulCollectionState {
  return { ...state, hudMode };
}

export function beginSoulRelease(state: SoulCollectionState): SoulCollectionState {
  if (
    state.activeSoulId ||
    state.releaseState !== "IDLE" ||
    deriveSoulCount(state) !== SOUL_REGISTRY.length
  ) return state;
  return { ...state, releaseState: "RELEASING" };
}

export function commitSoulRelease(state: SoulCollectionState): SoulCollectionState {
  if (state.releaseState !== "RELEASING") return state;
  return {
    ...state,
    releaseState: "RELEASED",
    slots: state.slots.map((slot) => ({ ...slot, status: "RELEASED" as const })),
  };
}

export function abortSoulRelease(state: SoulCollectionState): SoulCollectionState {
  return state.releaseState === "RELEASING"
    ? { ...state, releaseState: "IDLE" }
    : state;
}

export function seedSoulCollection(count: number): SoulCollectionState {
  const bounded = Math.max(0, Math.min(SOUL_REGISTRY.length, Math.trunc(count)));
  const initial = createInitialSoulCollectionState();
  return {
    ...initial,
    slots: initial.slots.map((slot, index) =>
      index < bounded
        ? {
            ...slot,
            status: "COLLECTED" as const,
            collectedAt: 0,
            variant: "NORMAL" as const,
            visualState: "ACTIVE" as const,
          }
        : slot,
    ),
  };
}
