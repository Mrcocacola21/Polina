import assert from "node:assert/strict";
import test from "node:test";

import {
  collectionAllowsContinue,
  createSingleExecutionLock,
  PHASE6_MUSIC_STATE,
  S01_COLLECTION,
  S01_COPY,
  S02_COLLECTION,
  S02_COPY,
  S02_NOTIFICATION_ASSETS,
  S02_NOTIFICATION_AUDIO,
} from "./phase6";

test("Phase 6 mandatory copy is byte-exact", () => {
  assert.equal(
    S01_COPY.full,
    "Просто существуя рядом в дискордике с тобой, я снова почувствовал себя спокойным",
  );
  assert.equal(`${S01_COPY.first}${S01_COPY.second}`, S01_COPY.full);
  assert.equal(
    S02_COPY.full,
    "Каждый раз, когда я вижу уведомление, я надеюсь, что оно от тебя",
  );
  assert.equal(
    `${S02_COPY.first}${S02_COPY.secondLead}${S02_COPY.finalWord}`,
    S02_COPY.full,
  );
});

test("Open Soul and special notification locks execute exactly once", () => {
  const openSoul = createSingleExecutionLock();
  const notification = createSingleExecutionLock();
  assert.equal(openSoul(), true);
  assert.equal(openSoul(), false);
  assert.equal(openSoul(), false);
  assert.equal(notification(), true);
  assert.equal(notification(), false);
});

test("Phase 6 uses NIGHT continuously and the required collection mapping", () => {
  assert.equal(PHASE6_MUSIC_STATE, "NIGHT");
  assert.deepEqual(S01_COLLECTION, {
    soulId: "SOUL_01",
    variant: "NORMAL",
    visualState: "ACTIVE",
  });
  assert.deepEqual(S02_COLLECTION, {
    soulId: "SOUL_02",
    variant: "NORMAL",
    visualState: "ACTIVE",
  });
});

test("S02 maps the two ordinary notifications and Polina special notification exactly", () => {
  assert.deepEqual(S02_NOTIFICATION_ASSETS, {
    ordinaryOne: "visual:screens.notificationOne",
    ordinaryTwo: "visual:screens.notificationTwo",
    special: "visual:screens.notificationPolina",
  });
});

test("S02 layers the personal Polina sound onto the authoritative open cue", () => {
  assert.deepEqual(S02_NOTIFICATION_AUDIO, {
    ordinary: "audio:scenes.s02.cue01",
    special: "audio:scenes.s02.cue02",
    open: "audio:scenes.s02.cue03",
    personalOpen: "audio:scenes.s02.notPolinaSound",
  });
});

test("continue remains gated until collection commits", () => {
  assert.equal(collectionAllowsContinue("collected"), true);
  assert.equal(collectionAllowsContinue("already-collected"), true);
  assert.equal(collectionAllowsContinue("in-progress"), false);
  assert.equal(collectionAllowsContinue("busy"), false);
  assert.equal(collectionAllowsContinue("cancelled"), false);
  assert.equal(collectionAllowsContinue("failed"), false);
});
