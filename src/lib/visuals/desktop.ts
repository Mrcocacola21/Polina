import type { VisualQuality } from "./quality";

export type DesktopViewport = Readonly<{
  width: number;
  height: number;
}>;

export const PRIMARY_DESKTOP_VIEWPORTS = Object.freeze([
  Object.freeze({ width: 1920, height: 1080 }),
  Object.freeze({ width: 2560, height: 1440 }),
] as const satisfies readonly DesktopViewport[]);

export const SECONDARY_DESKTOP_VIEWPORTS = Object.freeze([
  Object.freeze({ width: 1600, height: 900 }),
  Object.freeze({ width: 1440, height: 900 }),
  Object.freeze({ width: 1366, height: 768 }),
] as const satisfies readonly DesktopViewport[]);

export const DESKTOP_VISUAL_LOCK = Object.freeze({
  zoom: 1,
  coordinateSpace: "CSS_PIXELS" as const,
  intendedQuality: "HIGH" as VisualQuality,
  maxDevicePixelRatio: 2,
  primaryViewports: PRIMARY_DESKTOP_VIEWPORTS,
  secondaryViewports: SECONDARY_DESKTOP_VIEWPORTS,
});

export function scaleDesktopCoordinate(
  value: number,
  sourceExtent: number,
  targetExtent: number,
): number {
  if (![value, sourceExtent, targetExtent].every(Number.isFinite) || sourceExtent <= 0 || targetExtent <= 0) {
    throw new RangeError("Desktop coordinate scaling requires finite positive extents.");
  }
  return value * (targetExtent / sourceExtent);
}

