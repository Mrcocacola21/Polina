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
import type { ScenePhase } from "@/lib/cinematic/types";

import { VisualRuntime } from "./VisualRuntime";
import { createSceneVisualScopeId } from "./VisualScope";

const VisualRuntimeContext = createContext<VisualRuntime | null>(null);
const getServerRevision = () => 0;

export function VisualRuntimeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const runtime = useMemo(() => new VisualRuntime(), []);
  useEffect(() => () => runtime.dispose(), [runtime]);
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
  phase: ScenePhase,
): string {
  const runtime = useVisualRuntime();
  const scopeId = createSceneVisualScopeId(sceneId, runId);

  useEffect(() => {
    runtime.activateScope(scopeId);
    return () => runtime.cleanupScope(scopeId);
  }, [runtime, scopeId]);

  useEffect(() => {
    if (phase === "exiting") runtime.cleanupScope(scopeId);
  }, [phase, runtime, scopeId]);

  return scopeId;
}

