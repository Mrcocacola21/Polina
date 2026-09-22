import type { SceneId } from "./scenes";

export type ScenePhase = "entering" | "active" | "exiting";

export type CinematicState = Readonly<{
  currentSceneId: SceneId;
  phase: ScenePhase;
  runId: number;
  canAdvance: boolean;
  continueVisible: boolean;
}>;

export type SceneBoundEvent =
  | Readonly<{ type: "ENTER_COMPLETE"; runId: number }>
  | Readonly<{ type: "SET_CAN_ADVANCE"; runId: number; value: boolean }>
  | Readonly<{
      type: "SET_CONTINUE_VISIBLE";
      runId: number;
      value: boolean;
    }>
  | Readonly<{ type: "REQUEST_ADVANCE"; runId: number }>
  | Readonly<{ type: "EXIT_COMPLETE"; runId: number }>;

export type DirectorEvent =
  | Readonly<{ type: "RESTART_CURRENT" }>
  | Readonly<{ type: "JUMP_TO_SCENE"; sceneId: SceneId }>;

export type CinematicEvent = SceneBoundEvent | DirectorEvent;

export type SceneRuntime = Readonly<{
  sceneId: SceneId;
  phase: ScenePhase;
  runId: number;
  completeEnter: () => void;
  completeExit: () => void;
  setCanAdvance: (value: boolean) => void;
  setContinueVisible: (value: boolean) => void;
  requestAdvance: () => void;
}>;
