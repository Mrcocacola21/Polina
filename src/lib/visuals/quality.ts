export type VisualQuality = "HIGH" | "MEDIUM" | "LOW";
export type VisualQualityMode = "AUTO" | VisualQuality;

export const VISUAL_QUALITY = Object.freeze({
  HIGH: Object.freeze({ dprCap: 2, particleScale: 1 }),
  MEDIUM: Object.freeze({ dprCap: 1.5, particleScale: 0.7 }),
  LOW: Object.freeze({ dprCap: 1, particleScale: 0.4 }),
}) satisfies Readonly<Record<VisualQuality, Readonly<{
  dprCap: number;
  particleScale: number;
}>>>;

export const DEFAULT_VISUAL_QUALITY: VisualQuality = "MEDIUM";

export type DevicePerformanceHints = Readonly<{
  width: number;
  height: number;
  dpr: number;
  coarsePointer: boolean;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}>;

export function chooseInitialVisualQuality(hints: DevicePerformanceHints): VisualQuality {
  if ((hints.deviceMemory !== undefined && hints.deviceMemory <= 2) ||
      (hints.hardwareConcurrency !== undefined && hints.hardwareConcurrency <= 2)) return "LOW";
  if (hints.width < 600 && hints.dpr >= 2.5) return "LOW";
  if (hints.coarsePointer && (hints.dpr >= 2.5 || (hints.deviceMemory ?? 8) <= 4)) return "LOW";
  if (hints.coarsePointer || hints.width < 900) return "MEDIUM";
  return "HIGH";
}

export class AdaptiveQualityController {
  quality: VisualQuality;
  mode: VisualQualityMode = "AUTO";
  emaFrameMs = 16.67;
  reason = "initial capability profile";
  #slowSince: number | null = null;
  #fastSince: number | null = null;
  #lastChange = Number.NEGATIVE_INFINITY;

  constructor(initial: VisualQuality) { this.quality = initial; }

  setMode(mode: VisualQualityMode, now = 0): VisualQuality {
    this.mode = mode;
    if (mode !== "AUTO") {
      this.quality = mode;
      this.reason = "manual override";
      this.#lastChange = now;
    } else this.reason = "automatic monitoring";
    this.#slowSince = null;
    this.#fastSince = null;
    return this.quality;
  }

  sample(frameMs: number, now: number, visible = true): VisualQuality | null {
    if (!visible || frameMs <= 0 || frameMs > 250 || this.mode !== "AUTO") return null;
    this.emaFrameMs += (frameMs - this.emaFrameMs) * 0.08;
    if (now - this.#lastChange < 5_000) return null;
    if (this.emaFrameMs > 20.5 && this.quality !== "LOW") {
      this.#slowSince ??= now;
      this.#fastSince = null;
      if (now - this.#slowSince >= 2_000) {
        this.quality = this.quality === "HIGH" ? "MEDIUM" : "LOW";
        this.reason = `sustained ${this.emaFrameMs.toFixed(1)}ms frame time`;
        this.#lastChange = now;
        this.#slowSince = null;
        return this.quality;
      }
    } else if (this.emaFrameMs < 15.5 && this.quality !== "HIGH") {
      this.#fastSince ??= now;
      this.#slowSince = null;
      if (now - this.#fastSince >= 8_000) {
        this.quality = this.quality === "LOW" ? "MEDIUM" : "HIGH";
        this.reason = `sustained ${this.emaFrameMs.toFixed(1)}ms frame time`;
        this.#lastChange = now;
        this.#fastSince = null;
        return this.quality;
      }
    } else {
      this.#slowSince = null;
      this.#fastSince = null;
    }
    return null;
  }
}
