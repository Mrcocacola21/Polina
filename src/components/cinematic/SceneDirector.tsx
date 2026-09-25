"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import dynamic from "next/dynamic";

import {
  getNextScene,
  getSceneById,
  isSceneId,
  getSceneIndex,
  type SceneId,
} from "@/lib/cinematic/scenes";
import {
  cinematicReducer,
  INITIAL_CINEMATIC_STATE,
} from "@/lib/cinematic/scene-machine";
import { SceneRuntimeProvider } from "@/lib/cinematic/SceneRuntimeContext";
import { useAudioEngine, useSceneAudioScopeLifecycle } from "@/lib/audio/AudioEngineContext";
import { requestMediaForScene } from "@/lib/media/media-preloader";
import { useProgressiveMediaPrefetch } from "@/lib/media/MediaPreloadContext";
import { useSceneVisualScopeLifecycle, useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";
import { useSoulCollectionRuntime, useSoulCollectionSceneLifecycle } from "@/lib/souls/SoulCollectionContext";
import { SceneRenderer } from "@/components/scenes/SceneRenderer";
import { useTransitionRuntime } from "@/lib/cinematic/TransitionRuntimeContext";
import {
  getOutgoingTransition,
  type TransitionDefinition,
} from "@/lib/cinematic/transitions";

import { CinematicContinue } from "./CinematicContinue";
import styles from "./SceneDirector.module.css";

const MediaDebugPanel = dynamic(() => import("@/components/media/MediaDebugPanel").then((module) => module.MediaDebugPanel), { ssr: false });
const AudioDebugPanel = dynamic(() => import("@/components/audio/AudioDebugPanel").then((module) => module.AudioDebugPanel), { ssr: false });
const PerformanceDebugPanel = dynamic(() => import("@/components/visuals/PerformanceDebugPanel").then((module) => module.PerformanceDebugPanel), { ssr: false });
const SceneDebugOverlay = dynamic(() => import("./SceneDebugOverlay").then((module) => module.SceneDebugOverlay), { ssr: false });
const TransitionLab = dynamic(() => import("./TransitionLab").then((module) => module.TransitionLab), { ssr: false });

type SceneDirectorProps = Readonly<{
  debugEnabled?: boolean;
  sandboxEnabled?: boolean;
  requiemSandboxEnabled?: boolean;
  transitionLabEnabled?: boolean;
}>;

export function SceneDirector({
  debugEnabled = false,
  sandboxEnabled = false,
  requiemSandboxEnabled = false,
  transitionLabEnabled = false,
}: SceneDirectorProps) {
  const sandboxPreparedRef = useRef(false);
  const [labRun, setLabRun] = useState<TransitionDefinition | null>(null);
  const labStartedRef = useRef(false);
  const [state, dispatch] = useReducer(
    cinematicReducer,
    INITIAL_CINEMATIC_STATE,
  );
  const currentScene = getSceneById(state.currentSceneId);
  const nextScene = getNextScene(state.currentSceneId);
  const audio = useAudioEngine();
  const visual = useVisualRuntime();
  const collection = useSoulCollectionRuntime();
  const transition = useTransitionRuntime();
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
    transition.cancel();
    visual.cancelTransition();
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    dispatch({ type: "RESTART_CURRENT" });
  }, [transition, visual]);

  const jumpToScene = useCallback((sceneId: SceneId) => {
    transition.cancel();
    visual.cancelTransition();
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
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
  }, [audio, transition, visual]);

  useEffect(() => {
    if (state.phase === "exiting" && nextScene) {
      const definition = getOutgoingTransition(state.currentSceneId);
      if (definition) transition.begin(definition.from, definition.to, state.runId);
      void requestMediaForScene(nextScene.id).catch((error: unknown) => {
        if (process.env.NODE_ENV === "development") {
          console.error(`Unable to prepare incoming scene ${nextScene.id}.`, error);
        }
      });
      const active = document.activeElement;
      if (active instanceof HTMLElement) active.blur();
      return;
    }

    if (state.phase === "entering") {
      const snapshot = transition.getSnapshot();
      if (snapshot.status === "outgoing") {
        if (!transition.handoff(state.currentSceneId, state.runId)) transition.cancel();
      }
      return;
    }

    if (state.phase === "active") transition.reveal(state.currentSceneId, state.runId);
  }, [nextScene, state.currentSceneId, state.phase, state.runId, transition]);

  const seedForTransition = useCallback((definition: TransitionDefinition) => {
    const fromIndex = getSceneIndex(definition.from);
    const soulCount = definition.from.startsWith("S") && /^S\d\d$/.test(definition.from)
      ? Number(definition.from.slice(1))
      : fromIndex >= getSceneIndex("PRE_FINAL") ? 10 : 0;
    collection.seedCollectedSouls(soulCount);
  }, [collection]);

  const resetTransitionLab = useCallback((definition: TransitionDefinition) => {
    labStartedRef.current = false;
    setLabRun(null);
    transition.cancel();
    visual.cancelTransition();
    visual.leaveAbsoluteBlack();
    audio.leaveCinematicSilence();
    audio.stopAllAmbient({ fadeSeconds: 0 });
    audio.stopAllSfx();
    audio.stopAllProcedural();
    seedForTransition(definition);
    jumpToScene(definition.from === "REQUIEM" ? "SOULS_RELEASE" : definition.from);
  }, [audio, jumpToScene, seedForTransition, transition, visual]);

  const runTransitionLab = useCallback((definition: TransitionDefinition) => {
    resetTransitionLab(definition);
    setLabRun(definition);
  }, [resetTransitionLab]);

  useEffect(() => {
    if (!transitionLabEnabled || !labRun || labStartedRef.current || state.phase !== "active") return;
    if (state.currentSceneId !== labRun.from) return;
    labStartedRef.current = true;
    if (labRun.labAutoAdvance === false) return;
    dispatch({ type: "SET_CAN_ADVANCE", runId: state.runId, value: true });
    window.setTimeout(() => dispatch({ type: "REQUEST_ADVANCE", runId: state.runId }), 40);
  }, [labRun, state.currentSceneId, state.phase, state.runId, transitionLabEnabled]);

  useEffect(() => {
    if (!requiemSandboxEnabled || sandboxPreparedRef.current) return;
    sandboxPreparedRef.current = true;
    collection.seedCollectedSouls(10);
    jumpToScene("SOULS_RELEASE");
  }, [collection, jumpToScene, requiemSandboxEnabled]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const restart = () => restartCurrentScene();
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
  }, [jumpToScene, restartCurrentScene]);

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
      data-transition-state={transition.getSnapshot().status}
      data-transition-lab-run={labRun?.id ?? "NONE"}
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
          {!transitionLabEnabled ? (
            <>
              <SceneDebugOverlay
                key={`debug-${runKey}`}
                state={state}
                currentScene={currentScene}
                onJump={jumpToScene}
                onRestart={restartCurrentScene}
              />
              <MediaDebugPanel />
              <PerformanceDebugPanel />
              <AudioDebugPanel
                sceneId={state.currentSceneId}
                runId={state.runId}
              />
            </>
          ) : null}
          {transitionLabEnabled ? (
            <TransitionLab
              state={state}
              onRun={runTransitionLab}
              onReset={resetTransitionLab}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
