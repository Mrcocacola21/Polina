"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type Dispatch,
  type ReactNode,
} from "react";

import type {
  CinematicEvent,
  CinematicState,
  SceneRuntime,
} from "./types";

const SceneRuntimeContext = createContext<SceneRuntime | null>(null);

type SceneRuntimeProviderProps = Readonly<{
  state: CinematicState;
  dispatch: Dispatch<CinematicEvent>;
  children: ReactNode;
}>;

export function SceneRuntimeProvider({
  state,
  dispatch,
  children,
}: SceneRuntimeProviderProps) {
  const { currentSceneId, phase, runId } = state;

  const completeEnter = useCallback(() => {
    dispatch({ type: "ENTER_COMPLETE", runId });
  }, [dispatch, runId]);

  const completeExit = useCallback(() => {
    dispatch({ type: "EXIT_COMPLETE", runId });
  }, [dispatch, runId]);

  const setCanAdvance = useCallback(
    (value: boolean) => {
      dispatch({ type: "SET_CAN_ADVANCE", runId, value });
    },
    [dispatch, runId],
  );

  const setContinueVisible = useCallback(
    (value: boolean) => {
      dispatch({ type: "SET_CONTINUE_VISIBLE", runId, value });
    },
    [dispatch, runId],
  );

  const requestAdvance = useCallback(() => {
    dispatch({ type: "REQUEST_ADVANCE", runId });
  }, [dispatch, runId]);

  const runtime = useMemo<SceneRuntime>(
    () => ({
      sceneId: currentSceneId,
      phase,
      runId,
      completeEnter,
      completeExit,
      setCanAdvance,
      setContinueVisible,
      requestAdvance,
    }),
    [
      completeEnter,
      completeExit,
      currentSceneId,
      phase,
      requestAdvance,
      runId,
      setCanAdvance,
      setContinueVisible,
    ],
  );

  return (
    <SceneRuntimeContext.Provider value={runtime}>
      {children}
    </SceneRuntimeContext.Provider>
  );
}

export function useSceneRuntime(): SceneRuntime {
  const runtime = useContext(SceneRuntimeContext);

  if (!runtime) {
    throw new Error("useSceneRuntime must be used inside SceneDirector.");
  }

  return runtime;
}
