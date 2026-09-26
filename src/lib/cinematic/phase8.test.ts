import assert from "node:assert/strict";
import test from "node:test";

import {
  createPhase8ActivationLock,
  formatRating,
  normalizedPointInRect,
  PHASE8_MUSIC_STATE,
  phase8CollectionAllowsContinue,
  S06_COLLECTION,
  S06_COPY,
  S06_HEART_HOTSPOT,
  S07_COLLECTION,
  S07_COPY,
  S07_RATING_STEPS,
} from "./phase8";

test("Phase 8 mandatory copy is byte-exact and reconstructs exactly", () => {
  assert.equal(S06_COPY.full, "Каждый раз когда я выбиваю из тебя реакцию ❤️ или вижу его в сообщениях мне на душе становится так приятно");
  assert.equal(`${S06_COPY.first} ${S06_COPY.second} ${S06_COPY.thirdLead}${S06_COPY.soulWord}${S06_COPY.thirdTail}`, S06_COPY.full);
  assert.equal(S07_COPY.full, "Ты мне нравишься с головы до ног полностью и тебя я буду рейтить выше всех ВСЕГДА!!! (люблю твою попку, хехе❤️)");
  assert.equal(`${S07_COPY.sincere} ${S07_COPY.rating} ${S07_COPY.hero} ${S07_COPY.aside}`, S07_COPY.full);
});

test("hotspot math is normalized, responsive, and clamps", () => {
  const rect = { left: 100, top: 50, width: 330, height: 120 };
  const [x, y] = normalizedPointInRect(rect, S06_HEART_HOTSPOT);
  assert.ok(Math.abs(x - 139.6) < 1e-9);
  assert.ok(Math.abs(y - 136.4) < 1e-9);
  assert.deepEqual(normalizedPointInRect(rect, { x: -1, y: 2 }), [100, 170]);
});

test("S06 activation is strictly single-fire", () => {
  const activate = createPhase8ActivationLock();
  assert.equal(activate(), true);
  assert.equal(activate(), false);
  assert.equal(activate(), false);
});

test("Phase 8 collection and music configuration is canonical", () => {
  assert.equal(PHASE8_MUSIC_STATE, "MEMORIES");
  assert.deepEqual(S06_COLLECTION, { soulId: "SOUL_06", source: "POINT", variant: "NORMAL", visualState: "ACTIVE" });
  assert.deepEqual(S07_COLLECTION, { soulId: "SOUL_07", source: "POINT", variant: "NORMAL", visualState: "ACTIVE" });
});

test("rating progression is deterministic, exceeds 100, and resolves to infinity", () => {
  assert.deepEqual(S07_RATING_STEPS, [0, 34, 67, 91, 100, 112, 147, 238, 404]);
  assert.ok(S07_RATING_STEPS.some((value) => value > 100));
  assert.equal(formatRating(S07_RATING_STEPS.at(-1) ?? 0), "404%");
  assert.equal(formatRating(404, true), "∞");
});

test("continue gating accepts only committed semantics", () => {
  assert.equal(phase8CollectionAllowsContinue("collected"), true);
  assert.equal(phase8CollectionAllowsContinue("already-collected"), true);
  assert.equal(phase8CollectionAllowsContinue("cancelled"), false);
  assert.equal(phase8CollectionAllowsContinue("failed"), false);
});
