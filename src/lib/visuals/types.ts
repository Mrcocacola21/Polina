import type { VisualQuality, VisualQualityMode } from "./quality";

export type Vec3 = readonly [number, number, number];
export type SoulState = "DORMANT" | "ACTIVE" | "CHARGED";
export type ParticleMode =
  | "AMBIENT_DRIFT"
  | "ATTRACT"
  | "BURST"
  | "ORBIT"
  | "DISSOLVE";
export type FogVariant = "NEUTRAL" | "CRIMSON" | "HEAVY";
export type CursorMode =
  | "DEFAULT"
  | "INTERACTIVE"
  | "HIDDEN"
  | "ABSORPTION"
  | "DIMMED";
export type TransitionType =
  | "ORGANIC_DISSOLVE"
  | "SMOKE_REVEAL"
  | "SOUL_CIRCLE"
  | "VERTICAL_SLIT"
  | "FADE";

export type ParticleFieldOptions = Readonly<{
  mode?: ParticleMode;
  count?: number;
  position?: Vec3;
  spread?: Vec3;
  size?: readonly [number, number];
  opacity?: number;
  velocity?: number;
  drift?: number;
  lifetime?: number;
  fade?: number;
  attraction?: Vec3;
  attractionStrength?: number;
  color?: string;
  depthRange?: readonly [number, number];
  scopeId?: string;
}>;

export type SoulCreateOptions = Readonly<{
  position?: Vec3;
  scale?: number;
  state?: SoulState;
  scopeId?: string;
}>;

export type VisualMetrics = Readonly<{
  webgl: "initializing" | "ready" | "unavailable" | "lost";
  dpr: number;
  viewport: readonly [number, number];
  souls: number;
  particleSystems: number;
  particles: number;
  trails: number;
  fog: FogVariant | null;
  transition: "idle" | "covering" | "covered" | "revealing";
  scopes: number;
  cursor: CursorMode;
  pointerType: "fine" | "coarse" | "unknown";
  quality: VisualQuality;
  qualityMode: VisualQualityMode;
  fps: number;
  frameTimeMs: number;
  qualityReason: string;
}>;

export type VisualFxState = Readonly<{
  absoluteBlack: boolean;
  fog: FogVariant | null;
  fogOpacity: number;
  fogDuration: number;
  grain: number;
  vignette: number;
  vignetteSoftness: number;
  vignetteCenter: readonly [number, number];
  lightLeak: number;
  lightLeakScale: number;
  lightLeakPosition: readonly [number, number];
  lightLeakRotation: number;
  lightLeakDrift: boolean;
  cursor: CursorMode;
  transitionType: TransitionType;
  transitionState: VisualMetrics["transition"];
}>;
