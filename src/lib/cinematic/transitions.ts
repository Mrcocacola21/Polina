import type { MusicState } from "../audio/types";
import type { CursorMode, FogVariant, TransitionType } from "../visuals/types";
import { getNextScene, type SceneId } from "./scenes";

export type TransitionBridge =
  | "SOUL_CIRCLE_TO_ROOM"
  | "ROOM_TO_NOTIFICATION"
  | "NOTIFICATION_TO_MEMORY"
  | "MEMORY_TO_THREAD"
  | "THREAD_TO_MORNING"
  | "LIGHT_TO_HEART"
  | "HEART_TO_HALO"
  | "INFINITY_TO_THRONE"
  | "ASH_TO_HEAVINESS"
  | "ENVIRONMENT_TO_VOID"
  | "VOID_TO_VULNERABILITY"
  | "HUD_TO_RELEASE"
  | "SOULS_TO_REQUIEM"
  | "HARD_CUT"
  | "BLACK_TO_HEART";

export type TransitionDefinition = Readonly<{
  id: string;
  from: SceneId;
  to: SceneId;
  bridge: TransitionBridge;
  duration: number;
  revealDuration: number;
  mask: TransitionType | null;
  cursor: CursorMode;
  hud: "VISIBLE" | "DIMMED" | "HIDDEN";
  fog: FogVariant | null;
  music: MusicState | null;
  audioHandoff: string;
  semanticAssets: readonly string[];
  hardCut?: boolean;
  invisibleBoundary?: boolean;
  labAutoAdvance?: boolean;
}>;

const define = (definition: TransitionDefinition): TransitionDefinition =>
  Object.freeze({ ...definition, semanticAssets: Object.freeze([...definition.semanticAssets]) });

export const TRANSITION_DEFINITIONS: readonly TransitionDefinition[] = Object.freeze([
  define({ id: "PROLOGUE_S01", from: "PROLOGUE", to: "S01", bridge: "SOUL_CIRCLE_TO_ROOM", duration: 1.05, revealDuration: 1.05, mask: "SOUL_CIRCLE", cursor: "DEFAULT", hud: "VISIBLE", fog: "NEUTRAL", music: "NIGHT", audioHandoff: "AUD-PRO-01 tail under persistent MUS-01; room ambience enters after reveal", semanticAssets: ["visual:global.transitionSoulCircle", "visual:sections.section01Asset01"], labAutoAdvance: true }),
  define({ id: "S01_S02", from: "S01", to: "S02", bridge: "ROOM_TO_NOTIFICATION", duration: 0.9, revealDuration: 0.72, mask: null, cursor: "DEFAULT", hud: "VISIBLE", fog: null, music: "NIGHT", audioHandoff: "room tone fades before notification; MUS-01 remains on the same deck", semanticAssets: ["visual:screens.discord"], labAutoAdvance: true }),
  define({ id: "S02_S03", from: "S02", to: "S03", bridge: "NOTIFICATION_TO_MEMORY", duration: 1.35, revealDuration: 1.05, mask: null, cursor: "DEFAULT", hud: "VISIBLE", fog: "CRIMSON", music: "NIGHT", audioHandoff: "MUS-01 survives spatial entry; MUS-02 crossfade begins inside S03", semanticAssets: ["visual:sections.section03Asset02"], labAutoAdvance: true }),
  define({ id: "S03_S04", from: "S03", to: "S04", bridge: "MEMORY_TO_THREAD", duration: 1.55, revealDuration: 0.55, mask: null, cursor: "DEFAULT", hud: "VISIBLE", fog: "CRIMSON", music: "MEMORIES", audioHandoff: "memory ambience drains over 1.4s while MUS-02 remains continuous", semanticAssets: ["visual:screens.together", "visual:screens.minecraftTogether", "visual:screens.livingTogether"], labAutoAdvance: true }),
  define({ id: "S04_S05", from: "S04", to: "S05", bridge: "THREAD_TO_MORNING", duration: 1.2, revealDuration: 1.25, mask: "VERTICAL_SLIT", cursor: "DEFAULT", hud: "VISIBLE", fog: "NEUTRAL", music: "MEMORIES", audioHandoff: "MUS-02 filter restores while morning ambience enters below the slit", semanticAssets: ["visual:global.transitionVerticalSlit", "visual:sections.section05Asset02"], labAutoAdvance: true }),
  define({ id: "S05_S06", from: "S05", to: "S06", bridge: "LIGHT_TO_HEART", duration: 1.15, revealDuration: 0.8, mask: null, cursor: "DEFAULT", hud: "VISIBLE", fog: "CRIMSON", music: "MEMORIES", audioHandoff: "morning ambience fades around the contracting light; MUS-02 persists", semanticAssets: ["visual:sections.section05Asset02", "visual:screens.heartReaction"], labAutoAdvance: true }),
  define({ id: "S06_S07", from: "S06", to: "S07", bridge: "HEART_TO_HALO", duration: 1.15, revealDuration: 0.95, mask: null, cursor: "DEFAULT", hud: "VISIBLE", fog: "CRIMSON", music: "MEMORIES", audioHandoff: "heart response tail resolves before AUD-S07-01; no transition whoosh", semanticAssets: ["visual:screens.heartReaction", "visual:sections.section07Asset01"], labAutoAdvance: true }),
  define({ id: "S07_S08", from: "S07", to: "S08", bridge: "INFINITY_TO_THRONE", duration: 1.2, revealDuration: 0.92, mask: null, cursor: "DEFAULT", hud: "VISIBLE", fog: "CRIMSON", music: "MEMORIES", audioHandoff: "rating tail settles; Hall cue starts only after geometry appears", semanticAssets: ["visual:sections.section08Asset01", "visual:global.displacement"], labAutoAdvance: true }),
  define({ id: "S08_S09", from: "S08", to: "S09", bridge: "ASH_TO_HEAVINESS", duration: 1.25, revealDuration: 1.0, mask: null, cursor: "DIMMED", hud: "VISIBLE", fog: "HEAVY", music: "VULNERABILITY", audioHandoff: "Queen tails clear before pain drone/rain; MUS-02→MUS-03 crossfade remains singular", semanticAssets: ["visual:sections.section08Asset03", "visual:sections.section09Asset02"], labAutoAdvance: true }),
  define({ id: "S09_S10", from: "S09", to: "S10", bridge: "ENVIRONMENT_TO_VOID", duration: 1.25, revealDuration: 0.9, mask: null, cursor: "DIMMED", hud: "VISIBLE", fog: null, music: "VULNERABILITY", audioHandoff: "rain and drone reach zero before the anxiety rumble emerges; MUS-03 persists", semanticAssets: ["visual:sections.section09Asset02", "visual:sections.section10Asset01"], labAutoAdvance: true }),
  define({ id: "S10_PRE_FINAL", from: "S10", to: "PRE_FINAL", bridge: "VOID_TO_VULNERABILITY", duration: 1.25, revealDuration: 0.75, mask: null, cursor: "DIMMED", hud: "DIMMED", fog: null, music: "VULNERABILITY", audioHandoff: "rumble is removed and MUS-03 remains nearly absent without restarting", semanticAssets: [], labAutoAdvance: true }),
  define({ id: "PRE_FINAL_SOULS_RELEASE", from: "PRE_FINAL", to: "SOULS_RELEASE", bridge: "HUD_TO_RELEASE", duration: 0.85, revealDuration: 0.65, mask: null, cursor: "HIDDEN", hud: "VISIBLE", fog: "CRIMSON", music: null, audioHandoff: "MUS-03 reaches zero before the first released Soul", semanticAssets: ["visual:global.soulActive"], labAutoAdvance: true }),
  define({ id: "SOULS_RELEASE_REQUIEM", from: "SOULS_RELEASE", to: "REQUIEM", bridge: "SOULS_TO_REQUIEM", duration: 0.9, revealDuration: 0.8, mask: null, cursor: "HIDDEN", hud: "HIDDEN", fog: "CRIMSON", music: null, audioHandoff: "the release sound-space continues; Requiem cues own the escalation", semanticAssets: ["visual:global.soulActive", "visual:requiem.asset02"], labAutoAdvance: false }),
  define({ id: "REQUIEM_SILENCE", from: "REQUIEM", to: "SILENCE", bridge: "HARD_CUT", duration: 0, revealDuration: 0, mask: null, cursor: "HIDDEN", hud: "HIDDEN", fog: null, music: null, audioHandoff: "single-frame cut to zero audio through the cinematic silence gate", semanticAssets: [], hardCut: true, labAutoAdvance: false }),
  define({ id: "SILENCE_FINAL", from: "SILENCE", to: "FINAL", bridge: "BLACK_TO_HEART", duration: 0, revealDuration: 0, mask: null, cursor: "HIDDEN", hud: "HIDDEN", fog: null, music: null, audioHandoff: "the silence gate remains closed across the identical #000 frame", semanticAssets: ["visual:finale.asset01VariantC"], invisibleBoundary: true, labAutoAdvance: false }),
]);

export type FinalTransitionDefinition = Readonly<{
  id: "FINAL_ANSWERS" | "FINAL_YES" | "FINAL_THINK";
  duration: number;
  stillness: number;
  music: "HEART_AND_SOUL";
  technique: string;
}>;

export const FINAL_TRANSITIONS: readonly FinalTransitionDefinition[] = Object.freeze([
  Object.freeze({ id: "FINAL_ANSWERS", duration: 0.72, stillness: 0.45, music: "HEART_AND_SOUL", technique: "controls emerge together through restrained opacity and position" }),
  Object.freeze({ id: "FINAL_YES", duration: 1.1, stillness: 0.3, music: "HEART_AND_SOUL", technique: "controls dissolve, Heart reacts, then Soul echoes release" }),
  Object.freeze({ id: "FINAL_THINK", duration: 0.8, stillness: 0.3, music: "HEART_AND_SOUL", technique: "controls dissolve while the existing Heart settles without darkening" }),
]);

const byPair = new Map(TRANSITION_DEFINITIONS.map((definition) => [
  `${definition.from}->${definition.to}`,
  definition,
]));

export function getTransitionDefinition(from: SceneId, to: SceneId): TransitionDefinition | undefined {
  return byPair.get(`${from}->${to}`);
}

export function getOutgoingTransition(from: SceneId): TransitionDefinition | undefined {
  const next = getNextScene(from);
  return next ? getTransitionDefinition(from, next.id) : undefined;
}

export type TransitionRuntimeStatus = "idle" | "outgoing" | "incoming" | "revealing";

export type TransitionRuntimeSnapshot = Readonly<{
  status: TransitionRuntimeStatus;
  sequence: number;
  definition: TransitionDefinition | null;
  outgoingRunId: number | null;
  incomingRunId: number | null;
  startedAt: number | null;
}>;

const IDLE_TRANSITION: TransitionRuntimeSnapshot = Object.freeze({
  status: "idle",
  sequence: 0,
  definition: null,
  outgoingRunId: null,
  incomingRunId: null,
  startedAt: null,
});

export class TransitionRuntime {
  readonly #listeners = new Set<() => void>();
  #snapshot: TransitionRuntimeSnapshot = IDLE_TRANSITION;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  readonly getSnapshot = (): TransitionRuntimeSnapshot => this.#snapshot;

  #publish(snapshot: TransitionRuntimeSnapshot): void {
    this.#snapshot = snapshot;
    for (const listener of this.#listeners) listener();
  }

  begin(from: SceneId, to: SceneId, outgoingRunId: number, now = Date.now()): boolean {
    const definition = getTransitionDefinition(from, to);
    if (!definition || this.#snapshot.status !== "idle") return false;
    this.#publish({
      status: "outgoing",
      sequence: this.#snapshot.sequence + 1,
      definition,
      outgoingRunId,
      incomingRunId: null,
      startedAt: now,
    });
    return true;
  }

  handoff(to: SceneId, incomingRunId: number): boolean {
    const current = this.#snapshot;
    if (
      current.status !== "outgoing" ||
      current.definition?.to !== to ||
      current.outgoingRunId === null ||
      incomingRunId <= current.outgoingRunId
    ) return false;
    this.#publish({ ...current, status: "incoming", incomingRunId });
    return true;
  }

  reveal(sceneId: SceneId, runId: number): boolean {
    const current = this.#snapshot;
    if (current.status !== "incoming" || current.definition?.to !== sceneId || current.incomingRunId !== runId) {
      return false;
    }
    this.#publish({ ...current, status: "revealing" });
    return true;
  }

  finish(sequence: number): boolean {
    if (this.#snapshot.status !== "revealing" || this.#snapshot.sequence !== sequence) return false;
    this.#publish({ ...IDLE_TRANSITION, sequence });
    return true;
  }

  cancel(): void {
    const sequence = this.#snapshot.sequence;
    this.#publish({ ...IDLE_TRANSITION, sequence });
  }

  dispose(): void {
    this.cancel();
    this.#listeners.clear();
  }
}
