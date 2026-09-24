import type { MusicState } from "@/lib/audio/types";
import type { CollectionResultStatus, SoulVoice } from "@/lib/souls/types";
import type { SoulState } from "@/lib/visuals/types";

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
  voice: "A" satisfies SoulVoice,
});

export const S02_COLLECTION = Object.freeze({
  soulId: "SOUL_02",
  variant: "NORMAL",
  visualState: "ACTIVE" satisfies SoulState,
  voice: "NONE" satisfies SoulVoice,
});

export const PROLOGUE_TIMING = Object.freeze({
  firstLine: 2,
  firstLineOut: 5.5,
  secondLine: 6.5,
  aside: 10,
  copyOut: 12,
  action: 13.35,
  awaken: 1.15,
  transition: 1.15,
});

export const S01_TIMING = Object.freeze({
  screenshot: 0.5,
  firstLine: 3.2,
  secondLine: 7.4,
  settle: 9.6,
  collection: 11.55,
  continueDelay: 1.45,
  cameraPush: 21,
});

export const S02_TIMING = Object.freeze({
  ordinaryOne: 0.8,
  ordinaryOneOut: 3.25,
  ordinaryTwo: 4.25,
  ordinaryTwoOut: 6.7,
  special: 7.75,
  firstLineAfterOpen: 1.2,
  secondLineAfterOpen: 3.05,
  collectionAfterOpen: 6.25,
  continueDelay: 1.45,
});

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
