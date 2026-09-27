import type { CollectionVariant } from "./types";
import type { SoulId } from "./registry";

export const WAITING_SOUL_VISUAL = Object.freeze({
  opacity: 0.96,
  minimumOpacity: 0.88,
  scale: Object.freeze({ NORMAL: 1.16, SILENT: 1.16, DEEP: 1.1 }),
  glow: 1.08,
  aura: 0.94,
  minimumScreenSize: 72,
  maximumScreenSize: 152,
  safeMarginDesktop: 96,
  safeMarginMobile: 44,
  safeTopDesktop: 112,
  safeTopMobile: 88,
  safeBottom: 96,
  settleSeconds: 0.36,
  waitingZ: 1,
  renderOrder: 100,
});

type ScreenPoint = readonly [number, number];
type Viewport = readonly [number, number];

/**
 * Small composition-aware offsets applied after formation. They keep the
 * collectible away from its source media without replacing the source point.
 */
const CLAIM_NUDGE = Object.freeze({
  SOUL_01: [0.055, 0.035],
  SOUL_02: [0, 0],
  SOUL_03: [0, 0],
  SOUL_04: [0, 0],
  SOUL_05: [-0.05, 0.045],
  SOUL_06: [0.06, -0.045],
  SOUL_07: [0, 0.145],
  SOUL_08: [0.055, 0.065],
  SOUL_09: [0.045, 0.05],
  SOUL_10: [0, 0],
} satisfies Readonly<Record<SoulId, ScreenPoint>>);

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function waitingSoulScale(variant: CollectionVariant): number {
  return WAITING_SOUL_VISUAL.scale[variant];
}

export function resolveWaitingSoulPosition(
  soulId: SoulId,
  source: ScreenPoint,
  viewport: Viewport,
): ScreenPoint {
  const [width, height] = viewport;
  const mobile = width < 760;
  const side = Math.min(
    mobile ? WAITING_SOUL_VISUAL.safeMarginMobile : WAITING_SOUL_VISUAL.safeMarginDesktop,
    width * 0.22,
  );
  const top = Math.min(
    mobile ? WAITING_SOUL_VISUAL.safeTopMobile : WAITING_SOUL_VISUAL.safeTopDesktop,
    height * 0.24,
  );
  const bottom = Math.min(WAITING_SOUL_VISUAL.safeBottom, height * 0.22);
  const [nudgeX, nudgeY] = CLAIM_NUDGE[soulId];
  const motionScale = mobile ? 0.72 : 1;
  return [
    clamp(source[0] + width * nudgeX * motionScale, side, Math.max(side, width - side)),
    clamp(source[1] + height * nudgeY * motionScale, top, Math.max(top, height - bottom)),
  ];
}

export function isWaitingSoulWithinSafeBounds(
  position: ScreenPoint,
  viewport: Viewport,
): boolean {
  const [width, height] = viewport;
  const mobile = width < 760;
  const side = Math.min(
    mobile ? WAITING_SOUL_VISUAL.safeMarginMobile : WAITING_SOUL_VISUAL.safeMarginDesktop,
    width * 0.22,
  );
  const top = Math.min(
    mobile ? WAITING_SOUL_VISUAL.safeTopMobile : WAITING_SOUL_VISUAL.safeTopDesktop,
    height * 0.24,
  );
  const bottom = Math.min(WAITING_SOUL_VISUAL.safeBottom, height * 0.22);
  return position[0] >= side && position[0] <= width - side &&
    position[1] >= top && position[1] <= height - bottom;
}

export type WaitingSoulInvariantInput = Readonly<{
  visible: boolean;
  opacity: number;
  scale: number;
  screenSize: number;
  screenPosition: ScreenPoint;
  hitCenter: ScreenPoint;
  viewport: Viewport;
}>;

export function validateWaitingSoulVisual(input: WaitingSoulInvariantInput): readonly string[] {
  const issues: string[] = [];
  if (!input.visible) issues.push("controller-hidden");
  if (input.opacity < WAITING_SOUL_VISUAL.minimumOpacity) issues.push("opacity-below-floor");
  if (input.scale <= 0) issues.push("non-positive-scale");
  if (input.screenSize < WAITING_SOUL_VISUAL.minimumScreenSize) issues.push("screen-size-below-floor");
  if (input.screenSize > WAITING_SOUL_VISUAL.maximumScreenSize) issues.push("screen-size-above-ceiling");
  const [x, y] = input.screenPosition;
  const [width, height] = input.viewport;
  if (x < 0 || y < 0 || x > width || y > height) issues.push("outside-viewport");
  else if (!isWaitingSoulWithinSafeBounds(input.screenPosition, input.viewport)) {
    issues.push("outside-safe-bounds");
  }
  if (Math.hypot(x - input.hitCenter[0], y - input.hitCenter[1]) > 2) {
    issues.push("hit-target-misaligned");
  }
  return issues;
}
