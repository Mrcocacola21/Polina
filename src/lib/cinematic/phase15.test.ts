import assert from "node:assert/strict";
import test from "node:test";

import { SCENE_IDS, getNextScene } from "./scenes";
import {
  FINAL_TRANSITIONS,
  TRANSITION_DEFINITIONS,
  TransitionRuntime,
  getTransitionDefinition,
} from "./transitions";
import { getMemoryTransitionMetrics, MEMORY_TO_THREAD } from "./memory-transition";

test("every canonical production boundary after PROLOGUE has exactly one strategy", () => {
  const expected = SCENE_IDS.slice(1, -1).map((from) => `${from}->${getNextScene(from)!.id}`);
  const actual = TRANSITION_DEFINITIONS.map((item) => `${item.from}->${item.to}`);
  assert.deepEqual(actual, expected);
  assert.equal(new Set(actual).size, actual.length);
  assert.equal(getTransitionDefinition("PRE_FINAL", "SOULS_RELEASE")?.id, "PRE_FINAL_SOULS_RELEASE");
  assert.equal(getTransitionDefinition("SOULS_RELEASE", "REQUIEM")?.id, "SOULS_RELEASE_REQUIEM");
  assert.equal(getTransitionDefinition("REQUIEM", "SILENCE")?.hardCut, true);
  assert.equal(getTransitionDefinition("SILENCE", "FINAL")?.invisibleBoundary, true);
  assert.equal(getNextScene("FINAL"), undefined);
});

test("transition lock, runId handoff, reveal, and cancellation are stale-safe", () => {
  const runtime = new TransitionRuntime();
  assert.equal(runtime.begin("S03", "S04", 7, 100), true);
  assert.equal(runtime.begin("S03", "S04", 7, 101), false);
  assert.equal(runtime.handoff("S05", 8), false);
  assert.equal(runtime.handoff("S04", 7), false);
  assert.equal(runtime.handoff("S04", 8), true);
  assert.equal(runtime.reveal("S04", 7), false);
  assert.equal(runtime.reveal("S04", 8), true);
  const sequence = runtime.getSnapshot().sequence;
  assert.equal(runtime.finish(sequence - 1), false);
  assert.equal(runtime.finish(sequence), true);
  assert.equal(runtime.getSnapshot().status, "idle");

  assert.equal(runtime.begin("S08", "S09", 11), true);
  runtime.cancel();
  assert.equal(runtime.getSnapshot().status, "idle");
  assert.equal(runtime.handoff("S09", 12), false);
});

test("duration, mask, audio, cursor, HUD, and fallback metadata remain intentional", () => {
  for (const item of TRANSITION_DEFINITIONS) {
    assert.ok(item.duration >= 0 && item.duration <= (item.id === "S03_S04" ? 5 : 2));
    assert.ok(item.revealDuration >= 0 && item.revealDuration <= 2);
    assert.ok(item.audioHandoff.length > 12);
    assert.ok(["DEFAULT", "DIMMED", "HIDDEN", "INTERACTIVE", "ABSORPTION"].includes(item.cursor));
    assert.ok(["VISIBLE", "DIMMED", "HIDDEN"].includes(item.hud));
  }
  assert.equal(getTransitionDefinition("S01", "S02")?.mask, null);
  assert.equal(getTransitionDefinition("S03", "S04")?.mask, null);
  assert.equal(getTransitionDefinition("S04", "S05")?.mask, "VERTICAL_SLIT");
  assert.equal(FINAL_TRANSITIONS.length, 3);
  assert.equal(FINAL_TRANSITIONS.every((item) => item.music === "HEART_AND_SOUL"), true);
});

test("S03 to S04 contracts from three memories into one continuously owned thread", () => {
  const start = getMemoryTransitionMetrics(0);
  const hold = getMemoryTransitionMetrics(MEMORY_TO_THREAD.finalMemoryOnlyAt + 0.1);
  const dissolve = getMemoryTransitionMetrics(MEMORY_TO_THREAD.holdEndsAt + 0.25);
  const handoff = getMemoryTransitionMetrics(MEMORY_TO_THREAD.handoffAt, "incoming");
  assert.equal(MEMORY_TO_THREAD.finalMemoryId, "together");
  assert.equal(start.remainingMemoryCount, 3);
  assert.equal(hold.phase, "FINAL_MEMORY_HOLD");
  assert.equal(hold.remainingMemoryCount, 1);
  assert.equal(dissolve.phase, "DISSOLVING");
  assert.ok(dissolve.threadOpacity > 0);
  assert.equal(handoff.phase, "THREAD_ONLY");
  assert.equal(handoff.threadOpacity, MEMORY_TO_THREAD.threadOpacity);
  assert.equal(handoff.threadOwnership, "S04");
  assert.ok(handoff.musicFilterFrequency < 2_000);
});
