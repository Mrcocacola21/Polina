import assert from "node:assert/strict";
import test from "node:test";

import {
  createInteractionLock,
  evaluateMemoryCameraSpline,
  PHASE7_MUSIC_STATE,
  phase7CollectionAllowsContinue,
  S03_COLLECTION,
  S03_COPY,
  S04_COLLECTION,
  S04_COPY,
  S04_TIMING,
  S05_COLLECTION,
  S05_COPY,
} from "./phase7";

test("Phase 7 mandatory copy is byte-exact", () => {
  assert.equal(
    S03_COPY.full,
    "Я бы хотел разделять с тобой каждый момент этой жизни, они меня делают счастливыми",
  );
  assert.equal(`${S03_COPY.first} ${S03_COPY.second}`, S03_COPY.full);
  assert.equal(S04_COPY.full, "Я слишком быстро соскучиваюсь по тебе");
  assert.equal(
    S05_COPY.full,
    "Когда я просыпаюсь и вижу доброе утро от тебя, мое утро становится по-истинну добрым",
  );
  assert.equal(
    `${S05_COPY.first} ${S05_COPY.secondLead}${S05_COPY.finalWord}`,
    S05_COPY.full,
  );
});

test("Phase 7 collection sources, variants, states, and voices are canonical", () => {
  assert.deepEqual(S03_COLLECTION, {
    soulId: "SOUL_03",
    source: "POINTS",
    variant: "NORMAL",
    visualState: "ACTIVE",
    voice: "B",
  });
  assert.deepEqual(S04_COLLECTION, {
    soulId: "SOUL_04",
    source: "POINT",
    variant: "SILENT",
    visualState: "ACTIVE",
    voice: "NONE",
  });
  assert.deepEqual(S05_COLLECTION, {
    soulId: "SOUL_05",
    source: "POINT",
    variant: "NORMAL",
    visualState: "ACTIVE",
    voice: "NONE",
  });
});

test("MEMORIES remains one semantic music state and S04 tone is transient", () => {
  assert.equal(PHASE7_MUSIC_STATE, "MEMORIES");
  assert.ok(S04_TIMING.toneFrequency < 20_000);
  assert.ok(S04_TIMING.tonePresence < 1);
  assert.ok(S04_TIMING.toneRamp > 0);
});

test("S05 activation is idempotent", () => {
  const activate = createInteractionLock();
  assert.equal(activate(), true);
  assert.equal(activate(), false);
  assert.equal(activate(), false);
});

test("the S03 camera spline is directed, finite, and settles wider", () => {
  const entry = evaluateMemoryCameraSpline(0);
  const middle = evaluateMemoryCameraSpline(0.5);
  const settled = evaluateMemoryCameraSpline(1);
  for (const frame of [entry, middle, settled]) {
    for (const value of Object.values(frame)) assert.ok(Number.isFinite(value));
  }
  assert.ok(entry.z < middle.z);
  assert.ok(middle.z < settled.z);
  assert.deepEqual(evaluateMemoryCameraSpline(-1), entry);
  assert.deepEqual(evaluateMemoryCameraSpline(2), settled);
});

test("continue gating accepts committed and already-committed Souls only", () => {
  assert.equal(phase7CollectionAllowsContinue("collected"), true);
  assert.equal(phase7CollectionAllowsContinue("already-collected"), true);
  assert.equal(phase7CollectionAllowsContinue("in-progress"), false);
  assert.equal(phase7CollectionAllowsContinue("busy"), false);
  assert.equal(phase7CollectionAllowsContinue("cancelled"), false);
  assert.equal(phase7CollectionAllowsContinue("failed"), false);
});
