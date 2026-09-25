import type { MusicState } from "@/lib/audio/types";
import type { CollectionResultStatus, SoulSlotStatus, SoulVoice } from "@/lib/souls/types";
import type { SoulState } from "@/lib/visuals/types";

import { FILM_TIMING } from "./directing";

export const S10_COPY = Object.freeze({
  full: "Я тревожусь по маленьким поводам и могу надумать себе всякого, потому что люблю тебя и боюсь, что снова сделал что-то не так и потеряю тебя, твой интерес к себе или ты уйдешь к другому мальчику",
  segments: Object.freeze([
    "Я тревожусь по маленьким поводам",
    "и могу надумать себе всякого,",
    "потому что люблю тебя",
    "и боюсь, что снова сделал что-то не так",
    "и потеряю тебя,",
    "твой интерес к себе",
    "или ты уйдешь к другому мальчику",
  ] as const),
  calm: "потому что люблю тебя",
});

export const PRE_FINAL_COPY = Object.freeze({
  full: "Я не самый красивый, умный или что-то в этом роде, но можна я..",
  segments: Object.freeze([
    "Я не самый красивый,",
    "умный",
    "или что-то в этом роде,",
    "но можна я..",
  ] as const),
});

export const PHASE11_MUSIC_STATE = "VULNERABILITY" satisfies MusicState;

export const S10_COLLECTION = Object.freeze({
  soulId: "SOUL_10",
  source: "POINT",
  variant: "DEEP",
  visualState: "ACTIVE" satisfies SoulState,
  voice: "NONE" satisfies SoulVoice,
});

export const S10_TIMING = FILM_TIMING.s10;
export const PRE_FINAL_TIMING = FILM_TIMING.preFinal;

export const S10_DISTORTION = Object.freeze({
  stable: Object.freeze({ jitter: 0, liquid: 0, edge: 0 }),
  early: Object.freeze({ jitter: 0.18, liquid: 0, edge: 0 }),
  overthinking: Object.freeze({ jitter: 0.3, liquid: 0.12, edge: 0 }),
  returningFear: Object.freeze({ jitter: 0.24, liquid: 0.22, edge: 0.08 }),
  loss: Object.freeze({ jitter: 0.28, liquid: 0.3, edge: 0.16 }),
  interest: Object.freeze({ jitter: 0.2, liquid: 0.35, edge: 0.26 }),
  finalFear: Object.freeze({ jitter: 0.32, liquid: 0.26, edge: 0.52 }),
});

export const S10_AUDIO_LEVELS = Object.freeze({
  rumble: Object.freeze({
    entry: 0.003,
    early: 0.008,
    peak: 0.014,
    calm: 0.0004,
    fear: 0.009,
    final: 0.012,
    off: 0,
  }),
  tone: Object.freeze({
    entry: Object.freeze({ frequency: 7200, presence: 0.8 }),
    overthinking: Object.freeze({ frequency: 2800, presence: 0.62 }),
    calm: Object.freeze({ frequency: 14000, presence: 0.94 }),
    fear: Object.freeze({ frequency: 4300, presence: 0.68 }),
    final: Object.freeze({ frequency: 1750, presence: 0.42 }),
    collection: Object.freeze({ frequency: 920, presence: 0.22 }),
    preFinal: Object.freeze({ frequency: 760, presence: 0.16 }),
  }),
});

export const S10_VISUAL_LEVELS = Object.freeze({
  cameraScale: 1.042,
  reducedCameraScale: 1.008,
  vignette: Object.freeze({ entry: 0.58, middle: 0.7, calm: 0.54, fear: 0.76, final: 0.84, collection: 0.68 }),
  particleCount: Object.freeze({ low: 8, medium: 12, high: 18 }),
});

export function phase11CollectionAllowsContinue(status: CollectionResultStatus): boolean {
  return status === "collected" || status === "already-collected";
}

export function isS10AlreadyCommitted(status: SoulSlotStatus | undefined): boolean {
  return status === "COLLECTED" || status === "RELEASED";
}

export function reconstructCopy(segments: readonly string[]): string {
  return segments.join(" ");
}
