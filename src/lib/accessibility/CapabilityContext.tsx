"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_CAPABILITIES,
  detectCapabilities,
  resolveMotionMode,
  type CapabilitySnapshot,
} from "./capabilities";

type CapabilityOverride = Readonly<{
  reducedMotion?: boolean;
  audioUnavailable?: boolean;
  webglUnavailable?: boolean;
  failedMediaKind?: CapabilitySnapshot["failedMediaKind"];
}>;

type CapabilityContextValue = Readonly<{
  snapshot: CapabilitySnapshot;
  setDevelopmentOverride: (override: CapabilityOverride | null) => void;
}>;

const CapabilityContext = createContext<CapabilityContextValue | null>(null);

export function CapabilityProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [detected, setDetected] = useState<CapabilitySnapshot>(DEFAULT_CAPABILITIES);
  const [override, setOverride] = useState<CapabilityOverride | null>(null);

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setDetected(detectCapabilities());
    const updateMotion = () => setDetected((current) => ({
      ...current,
      motionMode: resolveMotionMode(motionQuery.matches),
    }));
    update();
    motionQuery.addEventListener("change", updateMotion);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("pageshow", update);
    return () => {
      motionQuery.removeEventListener("change", updateMotion);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("pageshow", update);
    };
  }, []);

  const setDevelopmentOverride = useCallback((next: CapabilityOverride | null) => {
    if (process.env.NODE_ENV === "development") setOverride(next);
  }, []);

  const snapshot = useMemo<CapabilitySnapshot>(() => ({
    ...detected,
    motionMode: override?.reducedMotion === undefined
      ? detected.motionMode
      : resolveMotionMode(override.reducedMotion),
    simulatedAudioUnavailable: override?.audioUnavailable ?? false,
    simulatedWebGLUnavailable: override?.webglUnavailable ?? false,
    failedMediaKind: override?.failedMediaKind ?? null,
  }), [detected, override]);

  useEffect(() => {
    document.documentElement.dataset.motionMode = snapshot.motionMode;
    document.documentElement.dataset.visibility = snapshot.visibility;
    return () => {
      delete document.documentElement.dataset.motionMode;
      delete document.documentElement.dataset.visibility;
    };
  }, [snapshot.motionMode, snapshot.visibility]);

  const value = useMemo(() => ({ snapshot, setDevelopmentOverride }), [setDevelopmentOverride, snapshot]);
  return <CapabilityContext.Provider value={value}>{children}</CapabilityContext.Provider>;
}

export function useCapabilities(): CapabilitySnapshot {
  const context = useContext(CapabilityContext);
  if (!context) throw new Error("Capability hooks require CapabilityProvider.");
  return context.snapshot;
}

export function useCapabilityActions() {
  const context = useContext(CapabilityContext);
  if (!context) throw new Error("Capability hooks require CapabilityProvider.");
  return { setDevelopmentOverride: context.setDevelopmentOverride };
}
