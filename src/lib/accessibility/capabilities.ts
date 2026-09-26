export type MotionMode = "FULL" | "REDUCED";
export type PageVisibility = "visible" | "hidden";

export type CapabilitySnapshot = Readonly<{
  motionMode: MotionMode;
  visibility: PageVisibility;
  webAudio: boolean;
  webgl: boolean;
  pointerEvents: boolean;
  resizeObserver: boolean;
  intersectionObserver: boolean;
  requestIdleCallback: boolean;
  visualViewport: boolean;
  simulatedAudioUnavailable: boolean;
  simulatedWebGLUnavailable: boolean;
  failedMediaKind: "image" | "video" | "audio" | null;
}>;

export const DEFAULT_CAPABILITIES: CapabilitySnapshot = Object.freeze({
  motionMode: "FULL",
  visibility: "visible",
  webAudio: true,
  webgl: true,
  pointerEvents: true,
  resizeObserver: true,
  intersectionObserver: true,
  requestIdleCallback: false,
  visualViewport: false,
  simulatedAudioUnavailable: false,
  simulatedWebGLUnavailable: false,
  failedMediaKind: null,
});

export function resolveMotionMode(reduced: boolean): MotionMode {
  return reduced ? "REDUCED" : "FULL";
}

export function motionIntensityFor(mode: MotionMode): number {
  return mode === "REDUCED" ? 0.28 : 1;
}

export function detectWebGL(documentLike: Pick<Document, "createElement">): boolean {
  try {
    const canvas = documentLike.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function detectCapabilities(): CapabilitySnapshot {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return DEFAULT_CAPABILITIES;
  }
  return {
    motionMode: resolveMotionMode(window.matchMedia("(prefers-reduced-motion: reduce)").matches),
    visibility: document.hidden ? "hidden" : "visible",
    webAudio: Boolean(window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext),
    webgl: detectWebGL(document),
    pointerEvents: "PointerEvent" in window,
    resizeObserver: "ResizeObserver" in window,
    intersectionObserver: "IntersectionObserver" in window,
    requestIdleCallback: "requestIdleCallback" in window,
    visualViewport: Boolean(window.visualViewport),
    simulatedAudioUnavailable: false,
    simulatedWebGLUnavailable: false,
    failedMediaKind: null,
  };
}

export function effectiveWebAudio(snapshot: CapabilitySnapshot): boolean {
  return snapshot.webAudio && !snapshot.simulatedAudioUnavailable;
}

export function effectiveWebGL(snapshot: CapabilitySnapshot): boolean {
  return snapshot.webgl && !snapshot.simulatedWebGLUnavailable;
}

export function shouldPauseCinematic(visibility: PageVisibility): boolean {
  return visibility === "hidden";
}

export function fallbackScreenToWorld(
  x: number,
  y: number,
  width: number,
  height: number,
  z = 0,
): readonly [number, number, number] {
  return [((x / Math.max(1, width)) - 0.5) * 10, (0.5 - y / Math.max(1, height)) * 6, z];
}
