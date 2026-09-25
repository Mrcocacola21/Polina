import assert from "node:assert/strict";
import test from "node:test";

import { AsyncDecodeCache } from "../audio/buffers";
import { selectOptimizedVariant } from "../media/catalog";
import { AdaptiveQualityController, chooseInitialVisualQuality, VISUAL_QUALITY } from "../visuals/quality";

test("capability profile preserves HIGH desktop and protects dense coarse screens", () => {
  assert.equal(chooseInitialVisualQuality({ width: 2560, height: 1440, dpr: 2, coarsePointer: false, deviceMemory: 8, hardwareConcurrency: 8 }), "HIGH");
  assert.equal(chooseInitialVisualQuality({ width: 390, height: 844, dpr: 3, coarsePointer: true, deviceMemory: 4, hardwareConcurrency: 8 }), "LOW");
  assert.equal(chooseInitialVisualQuality({ width: 390, height: 844, dpr: 3, coarsePointer: false, deviceMemory: 8, hardwareConcurrency: 8 }), "LOW");
  assert.deepEqual([VISUAL_QUALITY.HIGH.particleScale, VISUAL_QUALITY.MEDIUM.particleScale, VISUAL_QUALITY.LOW.particleScale], [1, 0.7, 0.4]);
});

test("adaptive quality requires sustained load and cooldown instead of oscillating", () => {
  const controller = new AdaptiveQualityController("HIGH");
  let change = null;
  for (let now = 0; now <= 4_000; now += 100) change = controller.sample(30, now) ?? change;
  assert.equal(change, "MEDIUM");
  assert.equal(controller.sample(30, 4_100), null);
  controller.setMode("LOW", 5_000);
  assert.equal(controller.quality, "LOW");
  controller.setMode("AUTO", 6_000);
  assert.equal(controller.sample(500, 20_000), null, "hidden-tab-sized frames are ignored");
});

test("optimized selection is capability-aware and keeps master fallback possible", () => {
  const entry = { kind: "image" as const, master: { path: "x.png", bytes: 1, sha256: "x" }, variants: [
    { path: "x.webp", bytes: 1, sha256: "a", profile: "default" as const, mimeType: "image/webp" },
    { path: "x.mobile.webp", bytes: 1, sha256: "b", profile: "mobile" as const, mimeType: "image/webp" },
  ] };
  assert.equal(selectOptimizedVariant(entry, { webp: true, opusWebm: false, mobileProfile: true })?.profile, "mobile");
  assert.equal(selectOptimizedVariant(entry, { webp: false, opusWebm: false, mobileProfile: false }), undefined);
});

test("decoded buffer cache is deduplicated and LRU-bounded", async () => {
  const cache = new AsyncDecodeCache<number>(2);
  let loads = 0;
  const first = cache.load("a", async () => ++loads);
  assert.equal(await cache.load("a", async () => ++loads), await first);
  await cache.load("b", async () => ++loads);
  await cache.load("c", async () => ++loads);
  assert.equal(cache.size, 2);
  await cache.load("a", async () => ++loads);
  assert.equal(loads, 4);
});
