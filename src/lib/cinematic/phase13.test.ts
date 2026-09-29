import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { SCENE_IDS } from "./scenes";
import {
  buildFinalQuestion,
  FINAL_ASSETS,
  FINAL_AUDIO,
  FINAL_LAYER_ORDER,
  FINAL_QUESTION,
  FINAL_QUESTION_STEPS,
  FINAL_TAG,
  FINAL_TIMING,
  SILENCE_LINES,
  SILENCE_TIMING,
} from "./phase13";

test("SILENCE preserves the exact four-line copy and a 2+ second empty opening", () => {
  assert.deepEqual(SILENCE_LINES, [
    "если убрать доту",
    "если убрать рофлы",
    "если убрать этот сайт",
    "останется одна вещь",
  ]);
  assert.ok(SILENCE_TIMING.initialBlack >= 2);
  assert.equal(SILENCE_TIMING.cues[0]?.revealAt, SILENCE_TIMING.initialBlack);
  assert.ok(SILENCE_TIMING.handoffAt >= 15 && SILENCE_TIMING.handoffAt <= 20);
});

test("the progressive words reconstruct the exact final question", () => {
  assert.deepEqual(FINAL_QUESTION_STEPS, ["Можна я", "буду с тобой", "сердцем", "и душой?"]);
  assert.equal(buildFinalQuestion(1), "Можна я");
  assert.equal(buildFinalQuestion(2), "Можна я буду с тобой");
  assert.equal(buildFinalQuestion(3), "Можна я буду с тобой сердцем");
  assert.equal(buildFinalQuestion(4), FINAL_QUESTION);
  assert.equal(FINAL_QUESTION, "Можна я буду с тобой сердцем и душой?");
  assert.equal(FINAL_TAG, "го встр типа");
});

test("Final media order and audio semantics match the authored payoff", () => {
  assert.deepEqual(FINAL_LAYER_ORDER, ["C", "A", "B", "FULL"]);
  assert.equal(FINAL_ASSETS.halo, "visual:finale.asset02");
  assert.equal(FINAL_ASSETS.keepsake, "visual:screens.prosOfDatingMe");
  assert.deepEqual(
    [FINAL_AUDIO.awakening, FINAL_AUDIO.merge, FINAL_AUDIO.halo],
    [
      "audio:final.soulHeartAwakening",
      "audio:final.twoSoulsMerge",
      "audio:final.haloBloom",
    ],
  );
  assert.equal(FINAL_AUDIO.musicState, "HEART_AND_SOUL");
  assert.ok(FINAL_TIMING.mergeConvergenceOffset > 2.5);
  assert.ok(FINAL_TIMING.tag - FINAL_TIMING.full >= 2.5);
});

test("SILENCE is audio-free and Final remains terminal after answer integration", () => {
  assert.equal(SCENE_IDS.at(-1), "FINAL");
  const silence = fs.readFileSync("src/components/scenes/SilenceBoundaryScene.tsx", "utf8");
  const final = fs.readFileSync("src/components/scenes/FinalScene.tsx", "utf8");
  assert.match(silence, /enterCinematicSilence/);
  assert.doesNotMatch(silence, /playSfx|playMusic|playAmbient|createLowRumble/);
  assert.match(final, /FINAL_AUDIO\.awakening/);
  assert.doesNotMatch(final, /collectSoul/);
  assert.doesNotMatch(final, /requestAdvance|setContinueVisible/);
});
