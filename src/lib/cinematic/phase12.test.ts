import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  calculateRadialPositions,
  REQUIEM_AUDIO_CUES,
  REQUIEM_HERO_VIDEO,
  REQUIEM_RADIAL_CONFIG,
  REQUIEM_SOUL_IDS,
  RequiemClock,
  releasePreconditionMet,
  SILENCE_BOUNDARY_CONTENT,
} from "./phase12";

test("release precondition requires exactly ten real Souls", () => {
  assert.equal(releasePreconditionMet(9), false);
  assert.equal(releasePreconditionMet(10), true);
  assert.equal(releasePreconditionMet(11), false);
});

test("ten unique Soul identities form a deterministic clockwise radial layout", () => {
  const first = calculateRadialPositions(1200, 800);
  const second = calculateRadialPositions(1200, 800);
  assert.equal(first.length, 10);
  assert.equal(new Set(REQUIEM_SOUL_IDS).size, 10);
  assert.deepEqual(first, second);
  assert.equal(first[0]?.soulId, "SOUL_01");
  assert.ok(Math.abs((first[0]?.x ?? 0) - 600) < 0.001);
  assert.ok((first[0]?.y ?? 999) < 400);
  for (let index = 1; index < first.length; index += 1) {
    assert.ok(first[index].angle > first[index - 1].angle);
  }
});

test("Soul choreography fully converges and the hero clip release follows the audio clock", () => {
  assert.ok(REQUIEM_RADIAL_CONFIG.gatheredRatio < REQUIEM_RADIAL_CONFIG.radiusRatio * 0.4);
  assert.ok(REQUIEM_RADIAL_CONFIG.lockedRatio <= REQUIEM_RADIAL_CONFIG.gatheredRatio);
  assert.equal(REQUIEM_RADIAL_CONFIG.inboundRatios.length, 4);
  const mappedRelease = REQUIEM_HERO_VIDEO.sourceReleaseTime - REQUIEM_HERO_VIDEO.startBeforeHero;
  assert.ok(Math.abs(mappedRelease - REQUIEM_AUDIO_CUES.cues.primaryImpact) <= 0.02);
  const mappedEnd = REQUIEM_HERO_VIDEO.sourceDuration - REQUIEM_HERO_VIDEO.startBeforeHero;
  assert.ok(Math.abs(mappedEnd - REQUIEM_AUDIO_CUES.cues.hardCut) <= 0.01);
});

test("cue crossing fires exactly once and catches skipped frames", () => {
  const clock = new RequiemClock(100, 7);
  assert.deepEqual(clock.tick(100.9, 7), []);
  assert.deepEqual(clock.tick(101.6, 7), ["pressureAccent", "ignition"]);
  assert.deepEqual(clock.tick(101.6, 7), []);
  assert.deepEqual(clock.tick(106, 7), ["primaryImpact", "secondaryWave", "finalSurge", "tailRelease", "hardCut"]);
  assert.deepEqual(clock.tick(107, 7), []);
});

test("restart clears cue latches while stale runs cannot cut", () => {
  const clock = new RequiemClock(10, 2);
  assert.deepEqual(clock.tick(20, 1), []);
  assert.equal(clock.hasFired("hardCut"), false);
  assert.deepEqual(clock.tick(20, 2).at(-1), "hardCut");
  assert.equal(clock.hasFired("hardCut"), true);
  clock.reset();
  assert.equal(clock.hasFired("hardCut"), false);
  assert.equal(clock.tick(20, 2).filter((cue) => cue === "hardCut").length, 1);
});

test("hard cut follows every hero event and remains inside measured duration", () => {
  const cues = REQUIEM_AUDIO_CUES.cues;
  assert.ok(cues.hardCut > cues.primaryImpact);
  assert.ok(cues.hardCut > cues.tailRelease);
  assert.ok(cues.hardCut <= REQUIEM_AUDIO_CUES.duration);
});

test("cinematic silence and absolute black are separate from user controls and transitions", () => {
  const audio = fs.readFileSync("src/lib/audio/AudioEngine.ts", "utf8");
  const visual = fs.readFileSync("src/lib/visuals/VisualRuntime.ts", "utf8");
  assert.match(audio, /#cinematicGain/);
  assert.match(audio, /enterCinematicSilence/);
  assert.doesNotMatch(audio.match(/enterCinematicSilence[\s\S]*?leaveCinematicSilence/)?.[0] ?? "", /setMasterVolume/);
  assert.match(visual, /enterAbsoluteBlack/);
  assert.match(visual, /absoluteBlack/);
});

test("Phase 12 hands an empty boundary to Phase 13 and Requiem has no forbidden music or voice", () => {
  assert.equal(SILENCE_BOUNDARY_CONTENT, "");
  const requiem = fs.readFileSync("src/components/scenes/RequiemScene.tsx", "utf8");
  assert.doesNotMatch(requiem, /MUS-04|playVoiceLine|soulVoice/);
});
