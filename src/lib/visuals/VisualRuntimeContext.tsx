"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import type { SceneId } from "@/lib/cinematic/scenes";

import { VisualRuntime } from "./VisualRuntime";
import { createSceneVisualScopeId } from "./VisualScope";
import { chooseInitialVisualQuality, type VisualQualityMode } from "./quality";

const VisualRuntimeContext = createContext<VisualRuntime | null>(null);
const getServerRevision = () => 0;

export function VisualRuntimeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const runtime = useMemo(() => new VisualRuntime(), []);
  useEffect(() => () => runtime.dispose(), [runtime]);
  useEffect(() => {
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    runtime.initializeAdaptiveQuality(chooseInitialVisualQuality({
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
      coarsePointer: window.matchMedia("(pointer: coarse)").matches,
      deviceMemory: memory,
      hardwareConcurrency: navigator.hardwareConcurrency,
    }));
  }, [runtime]);
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const setDebugQuality = (event: Event) => {
      const quality = (event as CustomEvent<{ quality?: VisualQualityMode }>).detail?.quality;
      if (!quality || !["AUTO", "HIGH", "MEDIUM", "LOW"].includes(quality)) return;
      runtime.setQuality(quality);
      document.documentElement.dataset.visualQuality = quality;
    };
    document.documentElement.dataset.visualQuality = runtime.quality;
    window.addEventListener("soulbound:debug-visual-quality", setDebugQuality);
    return () => {
      window.removeEventListener("soulbound:debug-visual-quality", setDebugQuality);
      delete document.documentElement.dataset.visualQuality;
    };
  }, [runtime]);
  return (
    <VisualRuntimeContext.Provider value={runtime}>
      {children}
    </VisualRuntimeContext.Provider>
  );
}

export function useVisualRuntime(): VisualRuntime {
  const runtime = useContext(VisualRuntimeContext);
  if (!runtime) throw new Error("Visual hooks require VisualRuntimeProvider.");
  return runtime;
}

export function useVisualRevision(): number {
  const runtime = useVisualRuntime();
  return useSyncExternalStore(
    runtime.subscribe,
    runtime.getRevision,
    getServerRevision,
  );
}

export function useVisualSnapshot() {
  const runtime = useVisualRuntime();
  useVisualRevision();
  return runtime.getSnapshot();
}

export function useVisualFx() {
  const runtime = useVisualRuntime();
  useVisualRevision();
  return runtime.fx;
}

export function useSceneVisualScopeLifecycle(
  sceneId: SceneId,
  runId: number,
): string {
  const runtime = useVisualRuntime();
  const scopeId = createSceneVisualScopeId(sceneId, runId);

  useEffect(() => {
    runtime.activateScope(scopeId);
    return () => runtime.cleanupScope(scopeId);
  }, [runtime, scopeId]);
  return scopeId;
}
