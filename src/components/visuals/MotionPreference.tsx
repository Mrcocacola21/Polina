"use client";

import { useEffect } from "react";

import { useCapabilities } from "@/lib/accessibility/CapabilityContext";
import { motionIntensityFor } from "@/lib/accessibility/capabilities";
import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";

export function MotionPreference() {
  const runtime = useVisualRuntime();
  const { motionMode } = useCapabilities();

  useEffect(() => {
    runtime.setMotionMode(motionMode, motionIntensityFor(motionMode));
  }, [motionMode, runtime]);

  return null;
}
