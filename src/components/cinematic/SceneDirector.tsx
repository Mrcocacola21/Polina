"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";

import {
  getNextScene,
  getSceneById,
  isSceneId,
  type SceneId,
} from "@/lib/cinematic/scenes";
import {
  cinematicReducer,
  INITIAL_CINEMATIC_STATE,
} from "@/lib/cinematic/scene-machine";
import { SceneRuntimeProvider } from "@/lib/cinematic/SceneRuntimeContext";
import { MediaDebugPanel } from "@/components/media/MediaDebugPanel";
import { AudioDebugPanel } from "@/components/audio/AudioDebugPanel";
import { useAudioEngine, useSceneAudioScopeLifecycle } from "@/lib/audio/AudioEngineContext";
import { requestMediaForScene } from "@/lib/media/media-preloader";
import { useProgressiveMediaPrefetch } from "@/lib/media/MediaPreloadContext";
import { useSceneVisualScopeLifecycle, useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";
import { useSoulCollectionRuntime, useSoulCollectionSceneLifecycle } from "@/lib/souls/SoulCollectionContext";
import { SceneRenderer } from "@/components/scenes/SceneRenderer";

import { CinematicContinue } from "./CinematicContinue";
import { SceneDebugOverlay } from "./SceneDebugOverlay";
import styles from "./SceneDirector.module.css";

type SceneDirectorProps = Readonly<{
  debugEnabled?: boolean;
  sandboxEnabled?: boolean;
  requiemSandboxEnabled?: boolean;
}>;

export function SceneDirector({
  debugEnabled = false,
  sandboxEnabled = false,
  requiemSandboxEnabled = false,
}: SceneDirectorProps) {
  const sandboxPreparedRef = useRef(false);
  const [state, dispatch] = useReducer(
    cinematicReducer,
    INITIAL_CINEMATIC_STATE,
  );
  const currentScene = getSceneById(state.currentSceneId);
  const nextScene = getNextScene(state.currentSceneId);
  const audio = useAudioEngine();
  const visual = useVisualRuntime();
  const collection = useSoulCollectionRuntime();
  useProgressiveMediaPrefetch(state.currentSceneId, state.phase);
  useSceneAudioScopeLifecycle(
    state.currentSceneId,
    state.runId,
  );
  useSceneVisualScopeLifecycle(
    state.currentSceneId,
    state.runId,
  );
  useSoulCollectionSceneLifecycle(
    state.currentSceneId,
    state.runId,
    state.phase,
  );

  const requestAdvance = useCallback(() => {
    dispatch({ type: "REQUEST_ADVANCE", runId: state.runId });
  }, [state.runId]);

  const restartCurrentScene = useCallback(() => {
    dispatch({ type: "RESTART_CURRENT" });
  }, []);

  const jumpToScene = useCallback((sceneId: SceneId) => {
    if (sceneId === "SILENCE" || sceneId === "FINAL") {
      audio.enterCinematicSilence();
      visual.enterAbsoluteBlack();
    } else {
      audio.leaveCinematicSilence();
      visual.leaveAbsoluteBlack();
    }
    void requestMediaForScene(sceneId).catch((error: unknown) => {
      if (process.env.NODE_ENV === "development") {
        console.error("Unable to request media for debug scene jump.", error);
      }
    });
    dispatch({ type: "JUMP_TO_SCENE", sceneId });
  }, [audio, visual]);

  useEffect(() => {
    if (!requiemSandboxEnabled || sandboxPreparedRef.current) return;
    sandboxPreparedRef.current = true;
    collection.seedCollectedSouls(10);
    jumpToScene("SOULS_RELEASE");
  }, [collection, jumpToScene, requiemSandboxEnabled]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const restart = () => dispatch({ type: "RESTART_CURRENT" });
    const jump = (event: Event) => {
      const sceneId = (event as CustomEvent<{ sceneId?: string }>).detail?.sceneId;
      if (sceneId && isSceneId(sceneId)) jumpToScene(sceneId);
    };
    window.addEventListener("soulbound:debug-restart-scene", restart);
    window.addEventListener("soulbound:debug-jump-scene", jump);
    return () => {
      window.removeEventListener("soulbound:debug-restart-scene", restart);
      window.removeEventListener("soulbound:debug-jump-scene", jump);
    };
  }, [jumpToScene]);

  const continueVisible = Boolean(
    state.phase === "active" &&
      state.canAdvance &&
      state.continueVisible &&
      nextScene,
  );
  const runKey = `${state.currentSceneId}:${state.runId}`;

  return (
    <div
      className={`${styles.director} ${sandboxEnabled ? styles.sandboxDirector : ""}`}
      data-testid="scene-director"
      data-scene-id={state.currentSceneId}
      data-scene-phase={state.phase}
      data-run-id={state.runId}
    >
      <SceneRuntimeProvider
        key={`scene-${runKey}`}
        state={state}
        dispatch={dispatch}
      >
        <SceneRenderer scene={currentScene} />
      </SceneRuntimeProvider>

      <CinematicContinue
        visible={continueVisible}
        nextSceneTitle={nextScene?.title}
        onContinue={requestAdvance}
      />

      {debugEnabled ? (
        <>
          <SceneDebugOverlay
            key={`debug-${runKey}`}
            state={state}
            currentScene={currentScene}
            onJump={jumpToScene}
            onRestart={restartCurrentScene}
          />
          <MediaDebugPanel />
          <AudioDebugPanel
            sceneId={state.currentSceneId}
            runId={state.runId}
          />
        </>
      ) : null}
    </div>
  );
}
