"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { SceneId } from "../cinematic/scenes";
import type { ScenePhase } from "../cinematic/types";
import { useSceneRuntime } from "../cinematic/SceneRuntimeContext";
import { AudioEngine, getAudioEngine } from "./AudioEngine";
import { createSceneAudioScopeId } from "./scopes";
import type {
  AmbientOptions,
  AmbientState,
  AudioEngineSnapshot,
  DuckOptions,
  FilteredNoiseOptions,
  LowRumbleOptions,
  RatingRiseOptions,
  SfxOptions,
  SoulHumOptions,
  UiToneOptions,
} from "./types";

const AudioEngineContext = createContext<AudioEngine | null>(null);
const getServerRevision = () => 0;

export function AudioEngineProvider({ children }: Readonly<{ children: ReactNode }>) {
  const engine = useMemo(() => getAudioEngine(), []);
  return (
    <AudioEngineContext.Provider value={engine}>
      {children}
    </AudioEngineContext.Provider>
  );
}

export function useAudioEngine(): AudioEngine {
  const engine = useContext(AudioEngineContext);
  if (!engine) {
    throw new Error("Audio hooks require AudioEngineProvider.");
  }
  return engine;
}

export function useAudioSnapshot(): AudioEngineSnapshot {
  const engine = useAudioEngine();
  useSyncExternalStore(
    engine.subscribe,
    engine.getRevision,
    getServerRevision,
  );
  return engine.getSnapshot();
}

export function useSceneAudioScopeLifecycle(
  sceneId: SceneId,
  runId: number,
  phase: ScenePhase,
): void {
  const engine = useAudioEngine();
  const scopeId = createSceneAudioScopeId(sceneId, runId);

  useEffect(() => {
    engine.activateScope(scopeId);
    return () => engine.cleanupScope(scopeId);
  }, [engine, scopeId]);

  useEffect(() => {
    if (phase === "exiting") engine.cleanupScope(scopeId);
  }, [engine, phase, scopeId]);
}

export function useSceneAudio() {
  const engine = useAudioEngine();
  const { sceneId, runId } = useSceneRuntime();
  const scopeId = createSceneAudioScopeId(sceneId, runId);

  return useMemo(
    () => ({
      scopeId,
      playSfx: (assetId: string, options: SfxOptions = {}) =>
        engine.playSfx(assetId, { ...options, scopeId }),
      playAmbient: (
        ambient: AmbientState | string,
        options: AmbientOptions = {},
      ) => engine.playAmbient(ambient, { ...options, scopeId }),
      duckMusic: (options: DuckOptions = {}) =>
        engine.duckBus("music", { ...options, scopeId }),
      createLowRumble: (options: LowRumbleOptions = {}) =>
        engine.createLowRumble({ ...options, scopeId }),
      createPulse: () => engine.createPulse(scopeId),
      createFilteredNoise: (options: FilteredNoiseOptions = {}) =>
        engine.createFilteredNoise({ ...options, scopeId }),
      playUiTone: (options: UiToneOptions = {}) =>
        engine.playUiTone({ ...options, scopeId }),
      startRatingRise: (options: RatingRiseOptions = {}) =>
        engine.startRatingRise({ ...options, scopeId }),
      createSoulHum: (options: SoulHumOptions = {}) =>
        engine.createSoulHum({ ...options, scopeId }),
    }),
    [engine, scopeId],
  );
}
