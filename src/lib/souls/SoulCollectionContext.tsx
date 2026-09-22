"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { useAudioEngine } from "@/lib/audio/AudioEngineContext";
import type { SceneId } from "@/lib/cinematic/scenes";
import type { ScenePhase } from "@/lib/cinematic/types";
import { useSceneRuntime } from "@/lib/cinematic/SceneRuntimeContext";
import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";

import { getSoulForScene } from "./registry";
import { SoulCollectionRuntime } from "./SoulCollectionRuntime";
import type { CollectSoulOptions, CollectionResult } from "./types";

const SoulCollectionContext = createContext<SoulCollectionRuntime | null>(null);
const getServerRevision = () => 0;

export function SoulCollectionProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const visual = useVisualRuntime();
  const audio = useAudioEngine();
  const runtime = useMemo(
    () => new SoulCollectionRuntime(visual, audio),
    [audio, visual],
  );
  useEffect(() => () => runtime.dispose(), [runtime]);

  return (
    <SoulCollectionContext.Provider value={runtime}>
      {children}
    </SoulCollectionContext.Provider>
  );
}

export function useSoulCollectionRuntime(): SoulCollectionRuntime {
  const runtime = useContext(SoulCollectionContext);
  if (!runtime) throw new Error("Soul collection hooks require SoulCollectionProvider.");
  return runtime;
}

export function useSoulCollectionSnapshot() {
  const runtime = useSoulCollectionRuntime();
  useSyncExternalStore(
    runtime.subscribe,
    runtime.getRevision,
    getServerRevision,
  );
  return runtime.getSnapshot();
}

export function useSoulCollectionSceneLifecycle(
  sceneId: SceneId,
  runId: number,
  phase: ScenePhase,
): void {
  const runtime = useSoulCollectionRuntime();
  useEffect(() => runtime.observeScene(sceneId, runId, phase), [
    phase,
    runId,
    runtime,
    sceneId,
  ]);
}

export function useSceneSoulCollection() {
  const runtime = useSoulCollectionRuntime();
  const scene = useSceneRuntime();
  const definition = getSoulForScene(scene.sceneId);
  const collect = useCallback(
    (
      options: Omit<CollectSoulOptions, "soulId" | "owner">,
    ): Promise<CollectionResult> => {
      if (!definition) {
        if (process.env.NODE_ENV === "development") {
          console.warn(`Scene ${scene.sceneId} has no collectible Soul.`);
        }
        return Promise.resolve({
          status: "failed",
          soulId: "SOUL_01",
          count: runtime.getSnapshot().count,
          reason: `Scene ${scene.sceneId} is not collectible.`,
        });
      }
      return runtime.collectSoul({
        ...options,
        soulId: definition.soulId,
        owner: { sceneId: scene.sceneId, runId: scene.runId },
      });
    },
    [definition, runtime, scene.runId, scene.sceneId],
  );

  return useMemo(
    () => ({ soulId: definition?.soulId, collect }),
    [collect, definition?.soulId],
  );
}
