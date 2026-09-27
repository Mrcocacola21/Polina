import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveWaitingSoulPosition,
  validateWaitingSoulVisual,
  WAITING_SOUL_VISUAL,
  waitingSoulScale,
} from "./waiting-visual";

test("waiting visual profile has production visibility floors", () => {
  assert.ok(WAITING_SOUL_VISUAL.minimumOpacity >= 0.8);
  assert.ok(WAITING_SOUL_VISUAL.minimumScreenSize >= 56);
  assert.ok(waitingSoulScale("NORMAL") > 0);
  assert.ok(waitingSoulScale("DEEP") > 0);
});

test("claim resting positions are clamped into desktop and mobile safe bounds", () => {
  assert.deepEqual(resolveWaitingSoulPosition("SOUL_01", [-200, -100], [1920, 1080]), [96, 112]);
  const mobile = resolveWaitingSoulPosition("SOUL_10", [500, 900], [390, 844]);
  assert.ok(mobile[0] <= 346);
  assert.ok(mobile[1] <= 748);
});

test("waiting validator detects hidden, tiny, offscreen, and misaligned Souls", () => {
  const issues = validateWaitingSoulVisual({
    visible: false,
    opacity: 0,
    scale: 0,
    screenSize: 8,
    screenPosition: [-20, 50],
    hitCenter: [200, 200],
    viewport: [1920, 1080],
  });
  assert.deepEqual(issues, [
    "controller-hidden",
    "opacity-below-floor",
    "non-positive-scale",
    "screen-size-below-floor",
    "outside-viewport",
    "hit-target-misaligned",
  ]);
});

test("waiting validator rejects oversized and edge-bound Souls", () => {
  const issues = validateWaitingSoulVisual({
    visible: true,
    opacity: WAITING_SOUL_VISUAL.opacity,
    scale: waitingSoulScale("NORMAL"),
    screenSize: WAITING_SOUL_VISUAL.maximumScreenSize + 1,
    screenPosition: [2, 2],
    hitCenter: [2, 2],
    viewport: [1920, 1080],
  });
  assert.deepEqual(issues, ["screen-size-above-ceiling", "outside-safe-bounds"]);
});

test("valid waiting Soul passes the invariant", () => {
  assert.deepEqual(validateWaitingSoulVisual({
    visible: true,
    opacity: WAITING_SOUL_VISUAL.opacity,
    scale: waitingSoulScale("NORMAL"),
    screenSize: 96,
    screenPosition: [960, 540],
    hitCenter: [960, 540],
    viewport: [1920, 1080],
  }), []);
});
