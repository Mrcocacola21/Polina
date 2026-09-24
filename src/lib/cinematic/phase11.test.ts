import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  isS10AlreadyCommitted,
  PHASE11_MUSIC_STATE,
  phase11CollectionAllowsContinue,
  PRE_FINAL_COPY,
  PRE_FINAL_TIMING,
  reconstructCopy,
  S10_AUDIO_LEVELS,
  S10_COLLECTION,
  S10_COPY,
  S10_DISTORTION,
  S10_TIMING,
} from "./phase11";

test("Phase 11 copy is exact and every segmentation reconstructs exactly", () => {
  assert.equal(S10_COPY.full, "Я тревожусь по маленьким поводам и могу надумать себе всякого, потому что люблю тебя и боюсь, что снова сделал что-то не так и потеряю тебя, твой интерес к себе или ты уйдешь к другому мальчику");
  assert.equal(reconstructCopy(S10_COPY.segments), S10_COPY.full);
  assert.equal(S10_COPY.calm, "потому что люблю тебя");
  assert.equal(S10_COPY.segments[2], S10_COPY.calm);
  assert.equal(PRE_FINAL_COPY.full, "Я не самый красивый, умный или что-то в этом роде, но можна я..");
  assert.equal(reconstructCopy(PRE_FINAL_COPY.segments), PRE_FINAL_COPY.full);
});

test("S10 has canonical final Soul collection semantics", () => {
  assert.equal(PHASE11_MUSIC_STATE, "VULNERABILITY");
  assert.deepEqual(S10_COLLECTION, {
    soulId: "SOUL_10",
    source: "POINT",
    variant: "DEEP",
    visualState: "ACTIVE",
    voice: "NONE",
  });
  assert.equal(phase11CollectionAllowsContinue("collected"), true);
  assert.equal(phase11CollectionAllowsContinue("already-collected"), true);
  assert.equal(phase11CollectionAllowsContinue("cancelled"), false);
  assert.equal(isS10AlreadyCommitted("COLLECTED"), true);
  assert.equal(isS10AlreadyCommitted("RELEASED"), true);
  assert.equal(isS10AlreadyCommitted("EMPTY"), false);
});

test("the calm beat removes instability and drops rumble almost to zero", () => {
  assert.deepEqual(S10_DISTORTION.stable, { jitter: 0, liquid: 0, edge: 0 });
  assert.ok(S10_AUDIO_LEVELS.rumble.calm <= 0.001);
  assert.ok(S10_AUDIO_LEVELS.tone.calm.frequency > S10_AUDIO_LEVELS.tone.overthinking.frequency);
  assert.ok(S10_TIMING.fear >= S10_TIMING.calm + S10_TIMING.calmHold);
});

test("fear returns progressively while preserving a conservative ceiling", () => {
  assert.ok(S10_DISTORTION.returningFear.jitter > 0);
  assert.ok(S10_DISTORTION.finalFear.edge > S10_DISTORTION.interest.edge);
  assert.ok(Math.max(...Object.values(S10_DISTORTION.finalFear)) <= 0.6);
});

test("PRE_FINAL contains only narrative timing and does not release Souls", () => {
  assert.ok(PRE_FINAL_TIMING.final - PRE_FINAL_TIMING.third >= 2.5);
  assert.ok(PRE_FINAL_TIMING.continue - PRE_FINAL_TIMING.final >= 4);
  const component = fs.readFileSync("src/components/scenes/PreFinalScene.tsx", "utf8");
  assert.doesNotMatch(component, /releaseAllForRequiem\s*\(/);
  assert.doesNotMatch(component, /collect\s*\(/);
});

test("S10 and PRE_FINAL remain production when the resolver is extended by Phase 12", () => {
  const resolver = fs.readFileSync("src/components/scenes/SceneRenderer.tsx", "utf8");
  assert.match(resolver, /S10:\s*Soul10Scene/);
  assert.match(resolver, /PRE_FINAL:\s*PreFinalScene/);
  assert.match(resolver, /SOULS_RELEASE:\s*SoulsReleaseScene/);
  assert.match(resolver, /REQUIEM:\s*RequiemScene/);
  assert.match(resolver, /SILENCE:\s*SilenceBoundaryScene/);
});
