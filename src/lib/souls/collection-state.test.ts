import assert from "node:assert/strict";
import test from "node:test";

import {
  beginSoulCollection,
  beginSoulRelease,
  cancelSoulCollection,
  commitSoulCollection,
  commitSoulRelease,
  createInitialSoulCollectionState,
  deriveSoulCount,
  seedSoulCollection,
} from "./collection-state";

test("collection state always contains exactly ten empty slots initially", () => {
  const state = createInitialSoulCollectionState();
  assert.equal(state.slots.length, 10);
  assert.equal(deriveSoulCount(state), 0);
  assert.equal(state.activeSoulId, null);
});

test("commit is the only transition that increments derived count", () => {
  const started = beginSoulCollection(createInitialSoulCollectionState(), "SOUL_01");
  assert.equal(started.outcome, "started");
  assert.equal(deriveSoulCount(started.state), 0);
  const committed = commitSoulCollection(started.state, "SOUL_01", {
    variant: "NORMAL",
    visualState: "ACTIVE",
    collectedAt: 12,
  });
  assert.equal(deriveSoulCount(committed), 1);
  assert.equal(committed.slots[0].status, "COLLECTED");
});

test("duplicate and concurrent collection requests are idempotent and locked", () => {
  const initial = createInitialSoulCollectionState();
  const first = beginSoulCollection(initial, "SOUL_01");
  assert.equal(beginSoulCollection(first.state, "SOUL_01").outcome, "in-progress");
  assert.equal(beginSoulCollection(first.state, "SOUL_02").outcome, "busy");
  const committed = commitSoulCollection(first.state, "SOUL_01", {
    variant: "SILENT",
    visualState: "DORMANT",
    collectedAt: 1,
  });
  assert.equal(beginSoulCollection(committed, "SOUL_01").outcome, "already-collected");
  assert.equal(deriveSoulCount(committed), 1);
});

test("cancellation restores collecting slot to empty without changing count", () => {
  const started = beginSoulCollection(createInitialSoulCollectionState(), "SOUL_04").state;
  const cancelled = cancelSoulCollection(started, "SOUL_04");
  assert.equal(cancelled.slots[3].status, "EMPTY");
  assert.equal(cancelled.activeSoulId, null);
  assert.equal(deriveSoulCount(cancelled), 0);
  assert.strictEqual(
    commitSoulCollection(cancelled, "SOUL_04", {
      variant: "NORMAL",
      visualState: "ACTIVE",
      collectedAt: 4,
    }),
    cancelled,
  );
});

test("release is refused below ten and allowed only at ten", () => {
  const five = seedSoulCollection(5);
  assert.strictEqual(beginSoulRelease(five), five);
  const ten = seedSoulCollection(10);
  const releasing = beginSoulRelease(ten);
  assert.equal(releasing.releaseState, "RELEASING");
  const released = commitSoulRelease(releasing);
  assert.equal(released.releaseState, "RELEASED");
  assert.equal(deriveSoulCount(released), 10);
  assert.ok(released.slots.every((slot) => slot.status === "RELEASED"));
});

test("debug seeding clamps and reset returns a clean zero state", () => {
  assert.equal(deriveSoulCount(seedSoulCollection(99)), 10);
  assert.equal(deriveSoulCount(seedSoulCollection(-4)), 0);
  assert.equal(deriveSoulCount(createInitialSoulCollectionState()), 0);
});

