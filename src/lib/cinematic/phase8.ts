import type { MusicState } from "@/lib/audio/types";
import type { CollectionResultStatus } from "@/lib/souls/types";
import type { SoulState } from "@/lib/visuals/types";

import { FILM_TIMING } from "./directing";

export const S06_COPY = Object.freeze({
  full: "Каждый раз когда я выбиваю из тебя реакцию ❤️ или вижу его в сообщениях мне на душе становится так приятно",
  first: "Каждый раз когда я выбиваю из тебя реакцию ❤️",
  second: "или вижу его в сообщениях",
  thirdLead: "мне на ",
  soulWord: "душе",
  thirdTail: " становится так приятно",
});

export const S07_COPY = Object.freeze({
  full: "Ты мне нравишься с головы до ног полностью и тебя я буду рейтить выше всех ВСЕГДА!!! (люблю твою попку, хехе❤️)",
  sincere: "Ты мне нравишься с головы до ног полностью",
  rating: "и тебя я буду рейтить выше всех",
  hero: "ВСЕГДА!!!",
  aside: "(люблю твою попку, хехе❤️)",
});

export const PHASE8_MUSIC_STATE = "MEMORIES" satisfies MusicState;

export const S06_HEART_HOTSPOT = Object.freeze({ x: 0.12, y: 0.72 });

export const S06_COLLECTION = Object.freeze({
  soulId: "SOUL_06",
  source: "POINT",
  variant: "NORMAL",
  visualState: "ACTIVE" satisfies SoulState,
});

export const S07_COLLECTION = Object.freeze({
  soulId: "SOUL_07",
  source: "POINT",
  variant: "NORMAL",
  visualState: "ACTIVE" satisfies SoulState,
});

export const S06_TIMING = FILM_TIMING.s06;
export const S07_TIMING = FILM_TIMING.s07;

export const S07_RATING_STEPS = Object.freeze([
  0, 34, 67, 91, 100, 112, 147, 238, 404,
] as const);

export function normalizedPointInRect(
  rect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  point: Readonly<{ x: number; y: number }>,
): readonly [number, number] {
  const x = Math.min(1, Math.max(0, point.x));
  const y = Math.min(1, Math.max(0, point.y));
  return [rect.left + rect.width * x, rect.top + rect.height * y];
}

export function createPhase8ActivationLock(): () => boolean {
  let activated = false;
  return () => {
    if (activated) return false;
    activated = true;
    return true;
  };
}

export function phase8CollectionAllowsContinue(status: CollectionResultStatus): boolean {
  return status === "collected" || status === "already-collected";
}

export function formatRating(value: number, resolved = false): string {
  if (resolved) return "∞";
  return `${Math.max(0, Math.round(value))}%`;
}
