import assert from "node:assert/strict";
import test from "node:test";

import { DuckRegistry } from "../audio/ducking";
import {
  COLLECTION_SCENE_SCALE,
  COLLECTION_TIMING,
  CROSSFADE_PRESETS,
  DUCK_PRESETS,
  FILM_MIX,
  FILM_TIMING,
  MUSIC_CUE_SEQUENCE,
} from "./directing";
import { getTransitionDefinition } from "./transitions";

function numericLeaves(value: unknown, path = "config"): Array<readonly [string, number]> {
  if (typeof value === "number") return [[path, value]];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => numericLeaves(child, `${path}.${key}`));
}

test("directing timings and crossfades are finite and deterministic", () => {
  for (const [path, value] of numericLeaves(FILM_TIMING)) {
    assert.equal(Number.isFinite(value), true, `${path} must be finite`);
    assert.ok(value >= 0, `${path} must not be negative`);
  }
  for (const [name, seconds] of Object.entries(CROSSFADE_PRESETS)) {
    assert.ok(seconds > 0, `${name} must complete over positive time`);
  }
  assert.equal(getTransitionDefinition("REQUIEM", "SILENCE")?.hardCut, true);
  assert.equal(getTransitionDefinition("REQUIEM", "SILENCE")?.duration, 0);
  assert.equal(getTransitionDefinition("SILENCE", "FINAL")?.duration, 0);
});

test("reading holds begin after reveal completion", () => {
  assert.ok(FILM_TIMING.s02.collectionAfterOpen - (FILM_TIMING.s02.secondLineAfterOpen + 1.1) >= 3);
  assert.ok(FILM_TIMING.s03.collection - (FILM_TIMING.s03.phraseTwo + 1.15) >= 3);
  assert.ok(FILM_TIMING.s08.deescalate - (FILM_TIMING.s08.secondDeclaration + 0.34) >= 1.7);
  assert.ok(FILM_TIMING.s09.finalHold - 1.45 >= 3.5);
  assert.ok(FILM_TIMING.s10.fear - (FILM_TIMING.s10.calm + 1.15) >= 3.4);
  assert.ok(FILM_TIMING.preFinal.continue - (FILM_TIMING.preFinal.final + 1.35) >= 3.4);
  assert.ok(FILM_TIMING.final.tag - (FILM_TIMING.final.full + 0.82) >= 2.6);
  assert.ok(FILM_TIMING.final.stable + FILM_TIMING.answer.revealDelayAfterFinalStable - (FILM_TIMING.final.tag + 0.82) >= 3.5);
});

test("collection rhythm varies while retaining NORMAL, SILENT, and DEEP semantics", () => {
  const totals = Object.fromEntries(Object.entries(COLLECTION_TIMING).map(([variant, timing]) => [
    variant,
    Object.values(timing).reduce((sum, value) => sum + value, 0),
  ]));
  assert.equal(totals.NORMAL < totals.DEEP, true);
  assert.notEqual(COLLECTION_SCENE_SCALE.S01, COLLECTION_SCENE_SCALE.S07);
  assert.equal(COLLECTION_TIMING.SILENT.flight > 0, true);
  assert.equal(new Set(Object.values(COLLECTION_SCENE_SCALE)).size > 3, true);
});

test("semantic music arc preserves zero, final restraint, and non-punitive THINK", () => {
  assert.deepEqual(MUSIC_CUE_SEQUENCE.map((cue) => cue.state), [
    "NIGHT", "MEMORIES", "VULNERABILITY", null, "HEART_AND_SOUL", "HEART_AND_SOUL", "HEART_AND_SOUL",
  ]);
  assert.equal(MUSIC_CUE_SEQUENCE.find((cue) => cue.id === "RELEASE_ZERO")?.gain, 0);
  assert.ok(FILM_MIX.music.finalPreAnswer < FILM_MIX.music.yes);
  assert.ok(FILM_MIX.music.think >= FILM_MIX.music.finalPreAnswer);
  assert.equal(MUSIC_CUE_SEQUENCE.find((cue) => cue.id === "YES_EXPANSION")?.restart, false);
  assert.equal(MUSIC_CUE_SEQUENCE.find((cue) => cue.id === "THINK_SETTLE")?.restart, false);
});

test("all cinematic gains remain in the safe configured linear range", () => {
  for (const [path, gain] of numericLeaves(FILM_MIX)) {
    if (path.endsWith("frequency")) continue;
    assert.ok(gain >= 0 && gain <= 1, `${path}=${gain} is outside 0..1`);
  }
  assert.ok(FILM_MIX.sfx.requiemHero > FILM_MIX.sfx.s08Declaration);
  assert.ok(FILM_MIX.sfx.requiemHero > FILM_MIX.sfx.yesRelease);
});

test("voice ducks cover their measured source durations and overlap releases safely", () => {
  assert.ok(DUCK_PRESETS.voiceA.attackSeconds + DUCK_PRESETS.voiceA.holdSeconds >= 3.9);
  assert.ok(DUCK_PRESETS.voiceB.attackSeconds + DUCK_PRESETS.voiceB.holdSeconds >= 3.1);
  assert.ok(DUCK_PRESETS.voiceC.attackSeconds + DUCK_PRESETS.voiceC.holdSeconds >= 2.3);
  const registry = new DuckRegistry();
  registry.add({ id: "a", bus: "music", to: 0.6 });
  registry.add({ id: "b", bus: "music", to: 0.72 });
  assert.equal(registry.getTarget("music"), 0.6);
  registry.remove("a");
  assert.equal(registry.getTarget("music"), 0.72);
  registry.remove("b");
  assert.equal(registry.getTarget("music"), 1);
});
