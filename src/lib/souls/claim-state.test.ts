import assert from "node:assert/strict";
import test from "node:test";

import { SOUL_CLAIM_AUDIO, SOUL_CLAIM_CONFIG, SOUL_WAITING_AUDIO } from "./claim-config";
import {
  advanceSoulClaim,
  cancelSoulClaim,
  claimSoul,
  createSoulClaimState,
  enterSoulWaiting,
} from "./claim-state";
import { SOUL_IDS } from "./registry";

test("every production Soul has one explicit claim configuration", () => {
  assert.deepEqual(Object.keys(SOUL_CLAIM_CONFIG), [...SOUL_IDS]);
  for (const soulId of SOUL_IDS) {
    const config = SOUL_CLAIM_CONFIG[soulId];
    assert.equal(config.mode, "EXPLICIT");
    assert.equal(config.idleAudio, SOUL_WAITING_AUDIO);
    assert.equal(config.collectAudio, SOUL_CLAIM_AUDIO);
    assert.ok(config.hitRadius >= 44);
  }
});

test("production voice assignment is deterministic and ends at Soul 8", () => {
  assert.deepEqual(
    SOUL_IDS.map((soulId) => SOUL_CLAIM_CONFIG[soulId].voice),
    ["A", "NONE", "B", "NONE", "NONE", "C", "NONE", "A", "NONE", "NONE"],
  );
});

test("FORMING enters WAITING and waiting never advances by itself", () => {
  const waiting = enterSoulWaiting(createSoulClaimState());
  assert.equal(waiting.stage, "WAITING");
  assert.strictEqual(enterSoulWaiting(waiting), waiting);
  assert.equal(waiting.locked, false);
});

test("the first hover claim locks the transaction", () => {
  const waiting = enterSoulWaiting(createSoulClaimState());
  const first = claimSoul(waiting, "POINTER");
  assert.equal(first.accepted, true);
  assert.deepEqual(first.state, { stage: "CLAIMED", locked: true, trigger: "POINTER" });
  assert.equal(claimSoul(first.state, "POINTER").accepted, false);
  assert.equal(claimSoul(first.state, "TOUCH").accepted, false);
  assert.equal(claimSoul(first.state, "KEYBOARD").accepted, false);
});

test("touch, keyboard, and development force claims use the same one-shot gate", () => {
  for (const trigger of ["TOUCH", "KEYBOARD", "FORCE"] as const) {
    const result = claimSoul(enterSoulWaiting(createSoulClaimState()), trigger);
    assert.equal(result.accepted, true);
    assert.equal(result.state.trigger, trigger);
  }
});

test("claim must precede flight, absorption, and commit", () => {
  const waiting = enterSoulWaiting(createSoulClaimState());
  assert.strictEqual(advanceSoulClaim(waiting, "FLYING"), waiting);
  const claimed = claimSoul(waiting, "POINTER").state;
  const flying = advanceSoulClaim(claimed, "FLYING");
  const absorbing = advanceSoulClaim(flying, "ABSORBING");
  const committed = advanceSoulClaim(absorbing, "COMMITTED");
  assert.equal(committed.stage, "COMMITTED");
});

test("restart or stale-run cancellation terminally locks a waiting claim", () => {
  const cancelled = cancelSoulClaim(enterSoulWaiting(createSoulClaimState()));
  assert.deepEqual(cancelled, { stage: "CANCELLED", locked: true, trigger: null });
  assert.equal(claimSoul(cancelled, "POINTER").accepted, false);
});
