import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  createS08RunGate,
  isS08AlreadyCommitted,
  PHASE9_MUSIC_STATE,
  phase9CollectionAllowsContinue,
  QUEEN_SOUL_VOICE,
  S08_AUDIO_CUE_ORDER,
  S08_CAMERA,
  S08_COLLECTION,
  S08_COPY,
} from "./phase9";

test("Phase 9 Queen declaration is exact and reconstructs exactly", () => {
  assert.equal(S08_COPY.full, "Королеву не убить, Я умру за королеву");
  assert.equal(`${S08_COPY.first}, ${S08_COPY.second}`, S08_COPY.full);
});

test("Phase 9 keeps MEMORIES and has canonical Soul 8 configuration", () => {
  assert.equal(PHASE9_MUSIC_STATE, "MEMORIES");
  assert.equal(QUEEN_SOUL_VOICE, "A");
  assert.deepEqual(S08_COLLECTION, {
    soulId: "SOUL_08",
    source: "POINT",
    variant: "NORMAL",
    visualState: "ACTIVE",
    voice: "A",
  });
});

test("Queen audio cues are ordered and single-fire per run", () => {
  assert.deepEqual(S08_AUDIO_CUE_ORDER, [
    "audio:scenes.s08.cue01",
    "audio:scenes.s08.cue02",
    "audio:scenes.s08.cue03",
    "audio:scenes.s08.cue04",
  ]);
  const gate = createS08RunGate();
  for (const cue of S08_AUDIO_CUE_ORDER) {
    assert.equal(gate.takeCue(cue), true);
    assert.equal(gate.takeCue(cue), false);
  }
  assert.deepEqual(gate.snapshot().cues, S08_AUDIO_CUE_ORDER);
});

test("collection gating handles commit, replay, and cleanup", () => {
  assert.equal(phase9CollectionAllowsContinue("collected"), true);
  assert.equal(phase9CollectionAllowsContinue("already-collected"), true);
  assert.equal(phase9CollectionAllowsContinue("cancelled"), false);
  assert.equal(phase9CollectionAllowsContinue("failed"), false);
  assert.equal(isS08AlreadyCommitted("COLLECTED"), true);
  assert.equal(isS08AlreadyCommitted("RELEASED"), true);
  assert.equal(isS08AlreadyCommitted("EMPTY"), false);

  const gate = createS08RunGate();
  assert.equal(gate.beginCollection(), true);
  assert.equal(gate.beginCollection(), false);
  gate.takeCue(S08_AUDIO_CUE_ORDER[0]);
  gate.reset();
  assert.deepEqual(gate.snapshot(), { cues: [], collectionStarted: false });
});

test("camera choreography has an identical deterministic reset", () => {
  assert.deepEqual(S08_CAMERA.start, { x: 0, y: 0, scale: 1, rotation: 0 });
  assert.ok(S08_CAMERA.end.scale > S08_CAMERA.start.scale);
  assert.ok(Math.abs(S08_CAMERA.secondImpact.x) <= 5);
  assert.ok(Math.abs(S08_CAMERA.secondImpact.y) <= 5);
});

test("S08 remains registered after later phases extend the resolver", () => {
  const resolver = fs.readFileSync("src/components/scenes/SceneRenderer.tsx", "utf8");
  assert.match(resolver, /S08:\s*Soul08Scene/);
});
