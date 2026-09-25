import assert from "node:assert/strict";
import test from "node:test";

import { AnswerController, ANSWER_LABELS } from "./phase14";
import { FINAL_QUESTION, FINAL_TAG, SILENCE_LINES } from "./phase13";
import { PRE_FINAL_COPY, S10_COPY } from "./phase11";
import { S09_COPY } from "./phase10";
import { S08_COPY } from "./phase9";
import { S06_COPY, S07_COPY } from "./phase8";
import { S03_COPY, S04_COPY, S05_COPY } from "./phase7";
import { S01_COPY, S02_COPY } from "./phase6";
import { CROSSFADE_PRESETS, FILM_MIX, FILM_TIMING } from "./directing";
import { SCENE_IDS } from "./scenes";
import { FINAL_TRANSITIONS, TRANSITION_DEFINITIONS } from "./transitions";
import { DESKTOP_VISUAL_LOCK, scaleDesktopCoordinate } from "../visuals/desktop";
import { VISUAL_QUALITY } from "../visuals/quality";
import type { CursorMode } from "../visuals/types";

const CANONICAL_SCENES = [
  "PRELOADER", "PROLOGUE", "S01", "S02", "S03", "S04", "S05", "S06", "S07",
  "S08", "S09", "S10", "PRE_FINAL", "SOULS_RELEASE", "REQUIEM", "SILENCE", "FINAL",
] as const;

test("desktop lock uses the two exact 16:9 CSS-pixel reference canvases", () => {
  assert.deepEqual(DESKTOP_VISUAL_LOCK.primaryViewports, [
    { width: 1920, height: 1080 },
    { width: 2560, height: 1440 },
  ]);
  assert.equal(DESKTOP_VISUAL_LOCK.zoom, 1);
  assert.equal(DESKTOP_VISUAL_LOCK.coordinateSpace, "CSS_PIXELS");
  assert.equal(DESKTOP_VISUAL_LOCK.intendedQuality, "HIGH");
  assert.equal(VISUAL_QUALITY.HIGH.dprCap, DESKTOP_VISUAL_LOCK.maxDevicePixelRatio);
});

test("responsive coordinate scaling is finite and deterministic", () => {
  const samples = [0, 1, 320, 960, 1920].map((value) => scaleDesktopCoordinate(value, 1920, 2560));
  assert.equal(samples[0], 0);
  assert.ok(Math.abs(samples[2] - (1280 / 3)) < Number.EPSILON * 2048);
  assert.deepEqual(samples.slice(3), [1280, 2560]);
  assert.deepEqual(samples, [0, 1, 320, 960, 1920].map((value) => scaleDesktopCoordinate(value, 1920, 2560)));
  assert.throws(() => scaleDesktopCoordinate(20, 0, 1920), RangeError);
});

test("Phase 16 timing and audio landmarks retain their locked production values", () => {
  assert.deepEqual(CROSSFADE_PRESETS, {
    noneToNight: 3,
    nightToMemories: 5.2,
    memoriesToVulnerability: 6.2,
    vulnerabilityToZero: 1.6,
    zeroToHeartAndSoul: 5.4,
    heartAndSoulYesExpansion: 2.6,
    heartAndSoulThinkSettle: 1.4,
  });
  assert.equal(FILM_TIMING.s03.cameraDuration, 17.5);
  assert.equal(FILM_TIMING.s08.secondDeclaration, 9.85);
  assert.equal(FILM_TIMING.requiem.heroStart, 4.3);
  assert.equal(FILM_TIMING.silence.handoffAt, 16.95);
  assert.equal(FILM_TIMING.final.stable, 17.05);
  assert.equal(FILM_MIX.sfx.requiemHero, 0.74);
  assert.equal(FILM_MIX.music.finalPreAnswer, 0.34);
  assert.equal(FILM_MIX.music.think, 0.4);
});

test("mandatory narrative copy and answer semantics remain exact", () => {
  assert.deepEqual([
    S01_COPY.full,
    S02_COPY.full,
    S03_COPY.full,
    S04_COPY.full,
    S05_COPY.full,
    S06_COPY.full,
    S07_COPY.full,
    S08_COPY.full,
    S09_COPY.full,
    S10_COPY.full,
    PRE_FINAL_COPY.full,
    ...SILENCE_LINES,
    FINAL_QUESTION,
    FINAL_TAG,
  ], [
    "Просто существуя рядом в дискордике с тобой, я снова почувствовал себя спокойным",
    "Каждый раз, когда я вижу уведомление, я надеюсь, что оно от тебя",
    "Я бы хотел разделять с тобой каждый момент этой жизни, они меня делают счастливыми",
    "Я слишком быстро соскучиваюсь по тебе",
    "Когда я просыпаюсь и вижу доброе утро от тебя, мое утро становится по-истинну добрым",
    "Каждый раз когда я выбиваю из тебя реакцию ❤️ или вижу его в сообщениях мне на душе становится так приятно",
    "Ты мне нравишься с головы до ног полностью и тебя я буду рейтить выше всех ВСЕГДА!!! (люблю твою попку, хехе❤️)",
    "Королеву не убить, Я умру за королеву",
    "Когда ты чувствуешь себя плохо, я честно стараюсь каждый раз тебя хоть как-то пожалеть или подбодрить, и если бы это было возможно - забрать всю боль, что ты чувствуешь",
    "Я тревожусь по маленьким поводам и могу надумать себе всякого, потому что люблю тебя и боюсь, что снова сделал что-то не так и потеряю тебя, твой интерес к себе или ты уйдешь к другому мальчику",
    "Я не самый красивый, умный или что-то в этом роде, но можна я..",
    "если убрать доту",
    "если убрать рофлы",
    "если убрать этот сайт",
    "останется одна вещь",
    "Можна я буду с тобой сердцем и душой?",
    "го встр типа",
  ]);
  assert.deepEqual(ANSWER_LABELS, { YES: "Да ❤️", THINK: "Подумать, но нежно" });
  const controller = new AnswerController();
  assert.equal(controller.commit("THINK", new Date("2026-09-25T12:00:00.000Z")).accepted, true);
  assert.equal(controller.commit("YES", new Date("2026-09-25T12:00:01.000Z")).accepted, false);
});

test("scene IDs, transition pairs, cursor semantics, and terminal answer transitions are unchanged", () => {
  assert.deepEqual(SCENE_IDS, CANONICAL_SCENES);
  assert.equal(TRANSITION_DEFINITIONS.length, CANONICAL_SCENES.length - 2);
  assert.deepEqual(TRANSITION_DEFINITIONS.map(({ from, to }) => `${from}->${to}`),
    CANONICAL_SCENES.slice(1, -1).map((from, index) => `${from}->${CANONICAL_SCENES[index + 2]}`));
  const cursorModes: readonly CursorMode[] = ["DEFAULT", "INTERACTIVE", "HIDDEN", "ABSORPTION", "DIMMED"];
  assert.deepEqual([...new Set(cursorModes)].sort(), ["ABSORPTION", "DEFAULT", "DIMMED", "HIDDEN", "INTERACTIVE"]);
  assert.deepEqual(FINAL_TRANSITIONS.map(({ id }) => id), ["FINAL_ANSWERS", "FINAL_YES", "FINAL_THINK"]);
});
