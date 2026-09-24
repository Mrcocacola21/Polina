import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { getNextScene } from "./scenes";
import {
  AnswerController,
  ANSWER_LABELS,
  ANSWER_PERSISTENCE_KEY,
  clearPersistedAnswer,
  formatAnswerDate,
  parsePersistedAnswer,
  persistAnswer,
  type StorageLike,
  YES_AUDIO_DURATIONS,
  YES_VISUAL_LEVELS,
} from "./phase14";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const date = new Date(2026, 8, 24, 21, 5, 7);

test("first answer wins atomically across double and cross-answer races", () => {
  const yesFirst = new AnswerController();
  const first = yesFirst.commit("YES", date);
  const timestamp = first.snapshot.answeredAt;
  assert.equal(first.accepted, true);
  assert.equal(first.snapshot.state, "COMMITTING_YES");
  assert.equal(first.snapshot.locked, true);
  assert.equal(yesFirst.commit("YES", new Date()).accepted, false);
  assert.equal(yesFirst.commit("THINK", new Date()).accepted, false);
  assert.equal(yesFirst.getSnapshot().answeredAt, timestamp);
  assert.equal(yesFirst.stabilize(first.snapshot.transaction).state, "YES");

  const thinkFirst = new AnswerController();
  const reverse = thinkFirst.commit("THINK", date);
  assert.equal(thinkFirst.commit("YES", new Date()).accepted, false);
  assert.equal(thinkFirst.stabilize(reverse.snapshot.transaction).state, "THINK");
});

test("persistence is versioned, validated, local, and preserves the original date", () => {
  const storage = new MemoryStorage();
  const controller = new AnswerController();
  const committed = controller.commit("YES", date);
  assert.ok(committed.record);
  assert.equal(persistAnswer(storage, committed.record!), true);
  assert.ok(storage.values.has(ANSWER_PERSISTENCE_KEY));
  const parsed = parsePersistedAnswer(storage.getItem(ANSWER_PERSISTENCE_KEY));
  assert.equal(parsed?.result, "YES");
  assert.equal(parsed?.answeredAt, date.toISOString());
  assert.equal(parsed?.finalDateDisplay, formatAnswerDate(date));
  assert.equal(formatAnswerDate(date), "24.09.2026");
  assert.equal(clearPersistedAnswer(storage), true);
  assert.equal(storage.getItem(ANSWER_PERSISTENCE_KEY), null);
});

test("invalid persistence and throwing storage fail safely", () => {
  for (const value of ["{", '{"version":2,"result":"YES","answeredAt":"2026-09-24T00:00:00.000Z"}', '{"version":1,"result":"NO","answeredAt":"2026-09-24T00:00:00.000Z"}', '{"version":1,"result":"YES"}']) {
    assert.equal(parsePersistedAnswer(value), null);
  }
  const throwing: StorageLike = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("quota"); },
    removeItem() { throw new Error("blocked"); },
  };
  const controller = new AnswerController();
  const committed = controller.commit("THINK", date);
  assert.equal(persistAnswer(throwing, committed.record!), false);
  assert.equal(clearPersistedAnswer(throwing), false);
  assert.equal(controller.stabilize(committed.snapshot.transaction).state, "THINK");
});

test("rehydration goes directly to stable branches and reset unlocks", () => {
  for (const result of ["YES", "THINK"] as const) {
    const controller = new AnswerController();
    const snapshot = controller.hydrate({ version: 1, result, answeredAt: date.toISOString(), finalDateDisplay: "24.09.2026" });
    assert.equal(snapshot.state, result);
    assert.equal(snapshot.locked, true);
    assert.equal(snapshot.state.startsWith("COMMITTING_"), false);
    const reset = controller.reset();
    assert.equal(reset.state, "UNANSWERED");
    assert.equal(reset.locked, false);
  }
});

test("ending configuration uses exact choices, ten echoes, measured audio, and terminal FINAL", () => {
  assert.deepEqual(ANSWER_LABELS, { YES: "Да ❤️", THINK: "Подумать, но нежно" });
  assert.equal(YES_VISUAL_LEVELS.soulEchoCount, 10);
  assert.deepEqual(YES_AUDIO_DURATIONS, { soulRelease: 4.4, finalResolve: 7.2 });
  assert.equal(getNextScene("FINAL"), undefined);
  const finalScene = fs.readFileSync("src/components/scenes/FinalScene.tsx", "utf8");
  assert.match(finalScene, /controller\.commit\(result\)/);
  assert.match(finalScene, /persistAnswer\(window\.localStorage/);
  assert.match(finalScene, /createSoul/);
  assert.match(finalScene, /spawnParticleField/);
  assert.doesNotMatch(finalScene, /fetch\(|sendBeacon|requestAdvance|setContinueVisible|collectSoul/);
});
