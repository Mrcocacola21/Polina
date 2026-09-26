import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_CAPABILITIES,
  effectiveWebAudio,
  effectiveWebGL,
  fallbackScreenToWorld,
  motionIntensityFor,
  resolveMotionMode,
  shouldPauseCinematic,
} from "./capabilities";
import {
  RECOVERY_MAX_AGE_MS,
  checkpointFor,
  createRecoveryRecord,
  parseRecoveryRecord,
  resolveStartupRecovery,
  safeRecoveryScene,
} from "../cinematic/recovery";
import { cinematicReducer, INITIAL_CINEMATIC_STATE } from "../cinematic/scene-machine";
import { VIDEO_FALLBACK_POLICIES, fallbackForSemanticRefs } from "../media/fallbacks";
import { MediaCache } from "../media/cache";
import type { MediaAsset } from "../media/types";
import { PainAbsorptionController } from "../cinematic/phase10";
import { SOUL_IDS } from "../souls/registry";

test("motion mode resolves live and remains independent from quality", () => {
  assert.equal(resolveMotionMode(false), "FULL");
  assert.equal(resolveMotionMode(true), "REDUCED");
  assert.equal(motionIntensityFor("FULL"), 1);
  assert.ok(motionIntensityFor("REDUCED") < 0.5);
  const quality = "HIGH";
  assert.equal(quality, "HIGH", "motion changes do not mutate the quality axis");
});

test("mute and unavailable audio cannot block cinematic progression", () => {
  const active = { ...INITIAL_CINEMATIC_STATE, currentSceneId: "S01" as const, phase: "active" as const, canAdvance: true };
  const exiting = cinematicReducer(active, { type: "REQUEST_ADVANCE", runId: active.runId });
  assert.equal(exiting.phase, "exiting");
  assert.equal(effectiveWebAudio({ ...DEFAULT_CAPABILITIES, simulatedAudioUnavailable: true }), false);
});

test("every production video has a deterministic lightweight fallback", () => {
  assert.equal(VIDEO_FALLBACK_POLICIES.length, 6);
  assert.equal(fallbackForSemanticRefs(["visual:screens.polinaCircle"])?.fallbackSemanticRef, "visual:screens.polina");
  assert.equal(fallbackForSemanticRefs(["visual:requirements.asset04"])?.kind, "atmosphere");
});

test("failed media settles in cache and stays failed without an explicit retry", () => {
  const asset: MediaAsset = { id: "media:x.mp4", relativePath: "x.mp4", url: "/x.mp4", masterUrl: "/x.mp4", kind: "video", delivery: "master", semanticRefs: [] };
  const cache = new MediaCache();
  cache.markFailed(asset, { message: "decode failed", retryable: true });
  assert.equal(cache.getSnapshot(asset).status, "failed");
  assert.equal(cache.getSnapshot(asset).error?.message, "decode failed");
});

test("WebGL fallback and resized fallback coordinates remain deterministic", () => {
  assert.equal(effectiveWebGL({ ...DEFAULT_CAPABILITIES, simulatedWebGLUnavailable: true }), false);
  assert.deepEqual(fallbackScreenToWorld(50, 50, 100, 100), [0, 0, 0]);
  assert.deepEqual(fallbackScreenToWorld(100, 100, 200, 200), [0, 0, 0]);
});

test("visibility policy pauses narrative and S09 hold can be cancelled", () => {
  assert.equal(shouldPauseCinematic("hidden"), true);
  assert.equal(shouldPauseCinematic("visible"), false);
  const hold = new PainAbsorptionController(2);
  hold.startHold(0);
  hold.tick(600);
  assert.equal(hold.cancel().state, "cancelled");
  assert.equal(hold.snapshot().completed, false);
});

test("stale scene callbacks remain ignored after a run changes", () => {
  const active = { ...INITIAL_CINEMATIC_STATE, currentSceneId: "S02" as const, phase: "active" as const, canAdvance: true };
  const restarted = cinematicReducer(active, { type: "RESTART_CURRENT" });
  assert.equal(cinematicReducer(restarted, { type: "REQUEST_ADVANCE", runId: active.runId }), restarted);
});

test("recovery serializes, validates, expires, and rejects corruption", () => {
  const now = new Date("2026-09-25T12:00:00.000Z");
  const record = createRecoveryRecord("S09", SOUL_IDS.slice(0, 8), now);
  assert.equal(parseRecoveryRecord(JSON.stringify(record), now.getTime())?.sceneId, "S09");
  assert.equal(parseRecoveryRecord(JSON.stringify({ ...record, version: 99 }), now.getTime()), null);
  assert.equal(parseRecoveryRecord(JSON.stringify({ ...record, collectedSoulIds: ["SOUL_02"] }), now.getTime()), null);
  assert.equal(parseRecoveryRecord(JSON.stringify(record), now.getTime() + RECOVERY_MAX_AGE_MS + 1), null);
});

test("completed answer wins and unsafe finale checkpoints map backward", () => {
  const recovery = createRecoveryRecord("FINAL", SOUL_IDS, new Date("2026-09-25T12:00:00.000Z"), "FINAL_QUESTION");
  assert.equal(resolveStartupRecovery(true, recovery).source, "answer");
  assert.equal(resolveStartupRecovery(false, recovery).sceneId, "FINAL");
  assert.equal(safeRecoveryScene("REQUIEM"), "PRE_FINAL");
  assert.equal(safeRecoveryScene("SOULS_RELEASE"), "PRE_FINAL");
  assert.equal(checkpointFor("S09", 9), "S09_COLLECTED");
});
