import assert from "node:assert/strict";
import test from "node:test";

import type { CinematicFracturePreset } from "./cinematic-fracture";
import { resolveCinematicFracture } from "./cinematic-fracture";

const hero: CinematicFracturePreset = {
  intensity: 1,
  sliceAmount: 18,
  sliceCount: 7,
  chromaticOffset: 3.5,
  verticalShear: 3,
  lumaTear: 0.18,
  frameEcho: 0.12,
  scanlineWarp: 0.24,
  edgeEnergy: 0.36,
  duration: 196,
  seed: 1203,
  blackTears: 2,
  radialStretch: 0.026,
};

test("quality and mobile tiers reduce geometric fracture cost", () => {
  const high = resolveCinematicFracture(hero, { quality: "HIGH", motionMode: "FULL", mobile: false });
  const medium = resolveCinematicFracture(hero, { quality: "MEDIUM", motionMode: "FULL", mobile: false });
  const lowMobile = resolveCinematicFracture(hero, { quality: "LOW", motionMode: "FULL", mobile: true });

  assert.equal(high.sliceCount, 7);
  assert.equal(high.chromaticOffset, 3.5);
  assert.ok(medium.sliceCount < high.sliceCount);
  assert.ok(medium.sliceAmount < high.sliceAmount);
  assert.ok(lowMobile.sliceCount <= 3);
  assert.ok(lowMobile.chromaticOffset <= 2);
  assert.ok(lowMobile.sliceAmount <= 14);
});

test("reduced motion resolves to one clean, short slice", () => {
  const reduced = resolveCinematicFracture(hero, { quality: "HIGH", motionMode: "REDUCED", mobile: false });

  assert.equal(reduced.sliceCount, 1);
  assert.equal(reduced.chromaticOffset, 0);
  assert.equal(reduced.verticalShear, 0);
  assert.equal(reduced.frameEcho, 0);
  assert.equal(reduced.scanlineWarp, 0);
  assert.ok(reduced.duration <= 140);
  assert.ok(reduced.radialStretch < hero.radialStretch);
});
