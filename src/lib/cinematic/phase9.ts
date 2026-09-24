import type { MusicState } from "@/lib/audio/types";
import type { CollectionResultStatus, SoulSlotStatus, SoulVoice } from "@/lib/souls/types";
import type { SoulState } from "@/lib/visuals/types";

export const S08_COPY = Object.freeze({
  full: "Королеву не убить, Я умру за королеву",
  first: "Королеву не убить",
  second: "Я умру за королеву",
});

export const PHASE9_MUSIC_STATE = "MEMORIES" satisfies MusicState;
export const QUEEN_SOUL_VOICE = "A" satisfies SoulVoice;

export const S08_COLLECTION = Object.freeze({
  soulId: "SOUL_08",
  source: "POINT",
  variant: "NORMAL",
  visualState: "ACTIVE" satisfies SoulState,
  voice: QUEEN_SOUL_VOICE,
});

export const S08_AUDIO_CUE_ORDER = Object.freeze([
  "audio:scenes.s08.cue01",
  "audio:scenes.s08.cue02",
  "audio:scenes.s08.cue03",
  "audio:scenes.s08.cue04",
] as const);

export type S08AudioCue = (typeof S08_AUDIO_CUE_ORDER)[number];

export const S08_TIMING = Object.freeze({
  entryReveal: 0.82,
  sigilPresence: 1.15,
  sigilActivation: 2.25,
  screenshot: 3.55,
  firstDeclaration: 5.15,
  fragments: 7.25,
  secondDeclaration: 9.65,
  deescalate: 11.35,
  collection: 13.75,
  continueDelay: 1.55,
});

export const S08_CAMERA = Object.freeze({
  start: Object.freeze({ x: 0, y: 0, scale: 1, rotation: 0 }),
  end: Object.freeze({ x: 0, y: -12, scale: 1.065, rotation: 0 }),
  firstImpact: Object.freeze({ x: 2.5, y: -1.5, scale: 1.004 }),
  secondImpact: Object.freeze({ x: -4, y: 2.5, scale: 1.01 }),
});

export function phase9CollectionAllowsContinue(status: CollectionResultStatus): boolean {
  return status === "collected" || status === "already-collected";
}

export function isS08AlreadyCommitted(status: SoulSlotStatus | undefined): boolean {
  return status === "COLLECTED" || status === "RELEASED";
}

export function createS08RunGate() {
  const cues = new Set<S08AudioCue>();
  let collectionStarted = false;

  return {
    takeCue(cue: S08AudioCue): boolean {
      if (cues.has(cue)) return false;
      cues.add(cue);
      return true;
    },
    beginCollection(): boolean {
      if (collectionStarted) return false;
      collectionStarted = true;
      return true;
    },
    reset(): void {
      cues.clear();
      collectionStarted = false;
    },
    snapshot(): Readonly<{ cues: readonly S08AudioCue[]; collectionStarted: boolean }> {
      return { cues: [...cues], collectionStarted };
    },
  };
}
