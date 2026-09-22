export type VisualQuality = "HIGH" | "MEDIUM" | "LOW";

export const VISUAL_QUALITY = Object.freeze({
  HIGH: Object.freeze({ dprCap: 2, particleScale: 1 }),
  MEDIUM: Object.freeze({ dprCap: 1.5, particleScale: 0.7 }),
  LOW: Object.freeze({ dprCap: 1, particleScale: 0.4 }),
}) satisfies Readonly<Record<VisualQuality, Readonly<{
  dprCap: number;
  particleScale: number;
}>>>;

export const DEFAULT_VISUAL_QUALITY: VisualQuality = "MEDIUM";

