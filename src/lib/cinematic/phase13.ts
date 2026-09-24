export const SILENCE_LINES = Object.freeze([
  "если убрать доту",
  "если убрать рофлы",
  "если убрать этот сайт",
  "останется одна вещь",
] as const);

export const SILENCE_TIMING = Object.freeze({
  initialBlack: 2.2,
  lineFadeIn: 0.65,
  lineFadeOut: 0.58,
  cues: Object.freeze([
    Object.freeze({ revealAt: 2.2, hideAt: 4.42 }),
    Object.freeze({ revealAt: 5.02, hideAt: 7.24 }),
    Object.freeze({ revealAt: 7.84, hideAt: 10.42 }),
    Object.freeze({ revealAt: 11.92, hideAt: 14.88 }),
  ]),
  handoffAt: 16.72,
  exit: 0,
});

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

export const FINAL_TIMING = Object.freeze({
  awakening: 0.92,
  firstWords: 1.16,
  core: 4.12,
  secondWords: 4.42,
  merge: 7.18,
  mergeWord: 8.54,
  mergeConvergenceOffset: 2.76,
  full: 11.56,
  fullQuestionHold: 2.82,
  tag: 14.38,
  stable: 15.35,
  musicFadeIn: 5.2,
});

export function buildFinalQuestion(stepCount: number): string {
  const safeCount = Math.max(0, Math.min(FINAL_QUESTION_STEPS.length, Math.trunc(stepCount)));
  return FINAL_QUESTION_STEPS.slice(0, safeCount).join(" ");
}

