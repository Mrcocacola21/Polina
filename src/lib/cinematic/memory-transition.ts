export const MEMORY_TO_THREAD = Object.freeze({
  finalMemoryId: "together",
  duration: 3.8,
  cameraDeceleration: 0.7,
  recessionStartsAt: 0.38,
  finalMemoryOnlyAt: 1.32,
  holdEndsAt: 2.18,
  dissolveEndsAt: 3.48,
  handoffAt: 3.8,
  revealDuration: 0.98,
  inheritedEntryDuration: 0.18,
  threadOnlyBeat: 0.85,
  threadOpacity: 0.56,
} as const);

export type MemoryTransitionPhase =
  | "IDLE"
  | "DECELERATING"
  | "MEMORIES_RECEDING"
  | "FINAL_MEMORY_HOLD"
  | "DISSOLVING"
  | "THREAD_HANDOFF"
  | "THREAD_ONLY";

export type MemoryTransitionMetrics = Readonly<{
  phase: MemoryTransitionPhase;
  cameraSpeed: number;
  remainingMemoryCount: number;
  threadOpacity: number;
  threadOwnership: "S03" | "BRIDGE" | "S04";
  musicFilterFrequency: number;
  musicPresence: number;
}>;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const progressBetween = (elapsed: number, from: number, to: number) =>
  clamp01((elapsed - from) / Math.max(0.001, to - from));
const smooth = (value: number) => value * value * (3 - 2 * value);

export function getMemoryTransitionMetrics(
  elapsed: number,
  ownership: "outgoing" | "incoming" | "revealing" | "idle" = "outgoing",
): MemoryTransitionMetrics {
  const time = Math.max(0, elapsed);
  const cameraSpeed = 1 - smooth(progressBetween(time, 0, MEMORY_TO_THREAD.cameraDeceleration));
  const threadProgress = smooth(progressBetween(time, MEMORY_TO_THREAD.holdEndsAt - 0.08, MEMORY_TO_THREAD.dissolveEndsAt - 0.12));
  const filterProgress = smooth(progressBetween(time, 0.42, MEMORY_TO_THREAD.handoffAt));
  let phase: MemoryTransitionPhase = "DECELERATING";
  if (ownership === "incoming" || ownership === "revealing") phase = "THREAD_ONLY";
  else if (time >= MEMORY_TO_THREAD.dissolveEndsAt) phase = "THREAD_HANDOFF";
  else if (time >= MEMORY_TO_THREAD.holdEndsAt) phase = "DISSOLVING";
  else if (time >= MEMORY_TO_THREAD.finalMemoryOnlyAt) phase = "FINAL_MEMORY_HOLD";
  else if (time >= MEMORY_TO_THREAD.recessionStartsAt) phase = "MEMORIES_RECEDING";

  return {
    phase,
    cameraSpeed,
    remainingMemoryCount: time >= MEMORY_TO_THREAD.dissolveEndsAt
      ? 0
      : time >= MEMORY_TO_THREAD.finalMemoryOnlyAt
        ? 1
        : time >= 0.82
          ? 2
          : 3,
    threadOpacity: ownership === "incoming" || ownership === "revealing"
      ? MEMORY_TO_THREAD.threadOpacity
      : MEMORY_TO_THREAD.threadOpacity * threadProgress,
    threadOwnership: ownership === "outgoing" ? "BRIDGE" : ownership === "idle" ? "S03" : "S04",
    musicFilterFrequency: 20_000 + (1_650 - 20_000) * filterProgress,
    musicPresence: 1 + (0.78 - 1) * filterProgress,
  };
}

