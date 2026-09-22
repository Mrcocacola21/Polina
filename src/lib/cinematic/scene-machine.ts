import { getNextScene, isSceneId } from "./scenes";
import type { CinematicEvent, CinematicState } from "./types";

export const INITIAL_CINEMATIC_STATE: CinematicState = Object.freeze({
  currentSceneId: "PRELOADER",
  phase: "entering",
  runId: 1,
  canAdvance: false,
  continueVisible: false,
});

function beginSceneRun(
  currentState: CinematicState,
  sceneId: CinematicState["currentSceneId"],
): CinematicState {
  return {
    currentSceneId: sceneId,
    phase: "entering",
    runId: currentState.runId + 1,
    canAdvance: false,
    continueVisible: false,
  };
}

export function cinematicReducer(
  state: CinematicState,
  event: CinematicEvent,
): CinematicState {
  if (event.type === "RESTART_CURRENT") {
    return beginSceneRun(state, state.currentSceneId);
  }

  if (event.type === "JUMP_TO_SCENE") {
    return isSceneId(event.sceneId)
      ? beginSceneRun(state, event.sceneId)
      : state;
  }

  if (event.runId !== state.runId) {
    return state;
  }

  switch (event.type) {
    case "ENTER_COMPLETE":
      return state.phase === "entering"
        ? { ...state, phase: "active" }
        : state;

    case "SET_CAN_ADVANCE":
      return state.phase === "active"
        ? { ...state, canAdvance: event.value }
        : state;

    case "SET_CONTINUE_VISIBLE":
      return state.phase === "active"
        ? { ...state, continueVisible: event.value }
        : state;

    case "REQUEST_ADVANCE": {
      const nextScene = getNextScene(state.currentSceneId);

      if (state.phase !== "active" || !state.canAdvance || !nextScene) {
        return state;
      }

      return {
        ...state,
        phase: "exiting",
        canAdvance: false,
        continueVisible: false,
      };
    }

    case "EXIT_COMPLETE": {
      if (state.phase !== "exiting") {
        return state;
      }

      const nextScene = getNextScene(state.currentSceneId);
      return nextScene ? beginSceneRun(state, nextScene.id) : state;
    }
  }
}
