import { FILM_TIMING } from "./directing";

export const SILENCE_LINES = Object.freeze([
  "если убрать доту",
  "если убрать рофлы",
  "если убрать этот сайт",
  "останется одна вещь",
] as const);

export const SILENCE_TIMING = FILM_TIMING.silence;

export const FINAL_QUESTION_STEPS = Object.freeze([
  "Можна я",
  "буду с тобой",
  "сердцем",
  "и душой?",
] as const);

export const FINAL_QUESTION = "Можна я буду с тобой сердцем и душой?";
export const FINAL_TAG = "го встр типа";

export const FINAL_AUDIO = Object.freeze({
  awakening: "audio:final.soulHeartAwakening",
  merge: "audio:final.twoSoulsMerge",
  halo: "audio:final.haloBloom",
  musicState: "HEART_AND_SOUL" as const,
});

export const FINAL_AUDIO_DURATIONS = Object.freeze({
  awakening: 3.7,
  merge: 4.349979,
  halo: 3.65,
});

export const FINAL_ASSETS = Object.freeze({
  dormant: "visual:finale.asset01VariantC",
  core: "visual:finale.asset01VariantA",
  energy: "visual:finale.asset01VariantB",
  full: "visual:finale.asset01",
  halo: "visual:finale.asset02",
});

export const FINAL_LAYER_ORDER = Object.freeze([
  "C",
  "A",
  "B",
  "FULL",
] as const);

export const FINAL_TIMING = FILM_TIMING.final;

export function buildFinalQuestion(stepCount: number): string {
  const safeCount = Math.max(0, Math.min(FINAL_QUESTION_STEPS.length, Math.trunc(stepCount)));
  return FINAL_QUESTION_STEPS.slice(0, safeCount).join(" ");
}
