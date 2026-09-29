import type { MusicState } from "@/lib/audio/types";
import type { CollectionResultStatus } from "@/lib/souls/types";
import type { SoulState } from "@/lib/visuals/types";

import { FILM_TIMING } from "./directing";

export const PROLOGUE_COPY = Object.freeze({
  lineOne: "я долго думал, как это сказать",
  lineTwo: "поэтому, конечно же, сделал целый сайт",
  aside: "логично",
  action: "открыть душу",
});

export const S01_COPY = Object.freeze({
  full: "Просто существуя рядом в дискордике с тобой, я снова почувствовал себя спокойным",
  first: "Просто существуя рядом в дискордике с тобой, ",
  second: "я снова почувствовал себя спокойным",
});

export const S02_COPY = Object.freeze({
  full: "Каждый раз, когда я вижу уведомление, я надеюсь, что оно от тебя",
  first: "Каждый раз, когда я вижу уведомление, ",
  secondLead: "я надеюсь, что оно от ",
  finalWord: "тебя",
});

export const PHASE6_MUSIC_STATE = "NIGHT" satisfies MusicState;

export const S01_COLLECTION = Object.freeze({
  soulId: "SOUL_01",
  variant: "NORMAL",
  visualState: "ACTIVE" satisfies SoulState,
});

export const S02_COLLECTION = Object.freeze({
  soulId: "SOUL_02",
  variant: "NORMAL",
  visualState: "ACTIVE" satisfies SoulState,
});

export const S02_NOTIFICATION_ASSETS = Object.freeze({
  ordinaryOne: "visual:screens.notificationOne",
  ordinaryTwo: "visual:screens.notificationTwo",
  special: "visual:screens.notificationPolina",
});

export const S02_NOTIFICATION_AUDIO = Object.freeze({
  ordinary: "audio:scenes.s02.cue01",
  special: "audio:scenes.s02.cue02",
  open: "audio:scenes.s02.cue03",
  personalOpen: "audio:scenes.s02.notPolinaSound",
});

export const PROLOGUE_TIMING = FILM_TIMING.prologue;
export const S01_TIMING = FILM_TIMING.s01;
export const S02_TIMING = FILM_TIMING.s02;

export function createSingleExecutionLock(): () => boolean {
  let locked = false;
  return () => {
    if (locked) return false;
    locked = true;
    return true;
  };
}

export function collectionAllowsContinue(
  status: CollectionResultStatus,
): boolean {
  return status === "collected" || status === "already-collected";
}
