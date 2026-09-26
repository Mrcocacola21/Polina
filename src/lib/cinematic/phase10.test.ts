import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  ABSORB_DURATION,
  ABSORB_RELEASE_DECAY,
  mapS09Fog,
  PainAbsorptionController,
  PHASE10_MUSIC_STATE,
  S09_COLLECTION,
  S09_COPY,
  S09_VISUAL_LEVELS,
} from "./phase10";

test("Phase 10 phrase is exact and segmented without rewriting", () => {
  assert.equal(S09_COPY.full, "Когда ты чувствуешь себя плохо, я честно стараюсь каждый раз тебя хоть как-то пожалеть или подбодрить, и если бы это было возможно - забрать всю боль, что ты чувствуешь");
  assert.equal([S09_COPY.first, S09_COPY.second, S09_COPY.third, S09_COPY.final].join(" "), S09_COPY.full);
});

test("S09 has the canonical deep, active, voiceless collection and music", () => {
  assert.equal(PHASE10_MUSIC_STATE, "VULNERABILITY");
  assert.deepEqual(S09_COLLECTION, {
    soulId: "SOUL_09",
    source: "POINT",
    variant: "DEEP",
    visualState: "ACTIVE",
  });
});

test("hold accumulation uses elapsed time and completes only while held", () => {
  const controller = new PainAbsorptionController();
  controller.startHold(100);
  assert.equal(controller.tick(100 + ABSORB_DURATION * 500).progress, 0.5);
  assert.equal(controller.tick(100 + ABSORB_DURATION * 1000 - 1).completed, false);
  const completed = controller.tick(100 + ABSORB_DURATION * 1000);
  assert.equal(completed.progress, 1);
  assert.equal(completed.completed, true);
  assert.equal(completed.state, "completed");
});

test("release decays smoothly, resumes, and cannot stale-complete", () => {
  const controller = new PainAbsorptionController();
  controller.startHold(0);
  controller.tick(1500);
  controller.endHold(1500);
  const partial = controller.tick(1500 + ABSORB_RELEASE_DECAY * 300);
  assert.ok(partial.progress > 0 && partial.progress < 0.6);
  assert.equal(partial.completed, false);
  controller.startHold(1900);
  assert.ok(controller.tick(2000).progress > partial.progress);
  controller.endHold(2000);
  assert.equal(controller.tick(10_000).progress, 0);
  assert.equal(controller.snapshot().completed, false);
});

test("completion latches once and cancellation invalidates the old run", () => {
  const completed = new PainAbsorptionController(1, 1);
  completed.startHold(0);
  completed.tick(1000);
  completed.endHold(2000);
  completed.startHold(3000);
  assert.deepEqual(completed.snapshot(), { progress: 1, state: "completed", completed: true });

  const cancelled = new PainAbsorptionController();
  cancelled.startHold(0);
  cancelled.tick(2400);
  assert.deepEqual(cancelled.cancel(), { progress: 0, state: "cancelled", completed: false });
  assert.deepEqual(cancelled.tick(100_000), { progress: 0, state: "cancelled", completed: false });
});

test("progress and partial fog mapping remain clamped", () => {
  assert.equal(mapS09Fog(-1), S09_VISUAL_LEVELS.fogResting);
  assert.equal(mapS09Fog(1), S09_VISUAL_LEVELS.fogCompleted);
  assert.equal(mapS09Fog(5), S09_VISUAL_LEVELS.fogCompleted);
  assert.ok(mapS09Fog(1) > 0);
  assert.ok(mapS09Fog(1) >= mapS09Fog(0) * 0.6);
});

test("S09 remains registered after later phases extend the resolver", () => {
  const resolver = fs.readFileSync("src/components/scenes/SceneRenderer.tsx", "utf8");
  assert.match(resolver, /S09:\s*Soul09Scene/);
});
