"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { TransitionRuntime, type TransitionRuntimeSnapshot } from "./transitions";

const TransitionRuntimeContext = createContext<TransitionRuntime | null>(null);
const SERVER_TRANSITION_SNAPSHOT: TransitionRuntimeSnapshot = Object.freeze({
  status: "idle" as const,
  sequence: 0,
  definition: null,
  outgoingRunId: null,
  incomingRunId: null,
  startedAt: null,
});
const getServerSnapshot = () => SERVER_TRANSITION_SNAPSHOT;

export function TransitionRuntimeProvider({ children }: Readonly<{ children: ReactNode }>) {
  const runtime = useMemo(() => new TransitionRuntime(), []);
  useEffect(() => () => runtime.dispose(), [runtime]);
  return (
    <TransitionRuntimeContext.Provider value={runtime}>
      {children}
    </TransitionRuntimeContext.Provider>
  );
}

export function useTransitionRuntime(): TransitionRuntime {
  const runtime = useContext(TransitionRuntimeContext);
  if (!runtime) throw new Error("Transition hooks require TransitionRuntimeProvider.");
  return runtime;
}

export function useTransitionSnapshot() {
  const runtime = useTransitionRuntime();
  return useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, getServerSnapshot);
}
