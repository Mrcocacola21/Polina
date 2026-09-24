"use client";

import { useEffect } from "react";

import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";

export function MotionPreference() {
  const runtime = useVisualRuntime();

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => runtime.setMotionIntensity(query.matches ? 0.35 : 1);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, [runtime]);

  return null;
}
