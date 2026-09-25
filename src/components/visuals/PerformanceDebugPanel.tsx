"use client";

import { useEffect, useState } from "react";

import { useAudioSnapshot } from "@/lib/audio/AudioEngineContext";
import { useMediaDiagnostics } from "@/lib/media/MediaPreloadContext";
import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";
import type { VisualQualityMode } from "@/lib/visuals/quality";

const MODES: readonly VisualQualityMode[] = ["AUTO", "HIGH", "MEDIUM", "LOW"];

export function PerformanceDebugPanel() {
  const runtime = useVisualRuntime();
  const media = useMediaDiagnostics();
  const audio = useAudioSnapshot();
  const [, refresh] = useState(0);
  const [enabled] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("perf") === "1");

  useEffect(() => {
    const timer = window.setInterval(() => refresh((value) => value + 1), 500);
    return () => window.clearInterval(timer);
  }, []);
  if (!enabled || process.env.NODE_ENV !== "development") return null;

  const visual = runtime.getSnapshot();
  return (
    <aside data-testid="performance-debug-panel" style={{ position: "fixed", right: 12, bottom: 12, zIndex: 10000, width: 280, padding: 12, color: "#f3cbd1", background: "rgba(12,3,7,.92)", border: "1px solid #672033", font: "11px/1.45 ui-monospace, monospace", pointerEvents: "auto" }}>
      <strong>PHASE 19 PERFORMANCE</strong>
      <div>{MODES.map((mode) => <button key={mode} type="button" onClick={() => runtime.setQuality(mode)} style={{ margin: "6px 3px 6px 0" }}>{mode}</button>)}</div>
      <div>quality {visual.qualityMode}/{visual.quality} · {visual.qualityReason}</div>
      <div>{visual.fps.toFixed(0)} fps · {visual.frameTimeMs.toFixed(1)} ms · DPR {visual.dpr.toFixed(2)}/{runtime.dprCap}</div>
      <div>{visual.particles} particles · {visual.particleSystems} systems · {visual.souls} souls</div>
      <div>WebGL {visual.webgl} · {visual.viewport.join("×")} · scopes {visual.scopes}</div>
      <div>preload {media.queue.active} active/{media.queue.queued} queued · cache {media.cachedAssets}</div>
      <div>audio buffers {audio.decodedSfxCount} · ambient {audio.activeAmbientCount} · sfx {audio.activeSfxCount}</div>
      <div>DOM media {typeof document === "undefined" ? 0 : document.querySelectorAll("video,audio").length}</div>
    </aside>
  );
}
