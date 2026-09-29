import type { MusicState } from "@/lib/audio/types";
import type { CollectionResultStatus, SoulSlotStatus } from "@/lib/souls/types";
import type { SoulState } from "@/lib/visuals/types";

import { FILM_TIMING } from "./directing";

export const S08_COPY = Object.freeze({
  full: "Королеву не убить, Я умру за королеву",
  first: "Королеву не убить",
  second: "Я умру за королеву",
});

export const PHASE9_MUSIC_STATE = "MEMORIES" satisfies MusicState;
/** Legacy production note; the runtime assignment lives in SOUL_CLAIM_CONFIG. */
export const QUEEN_SOUL_VOICE = "A" as const;

export const S08_COLLECTION = Object.freeze({
  soulId: "SOUL_08",
  source: "POINT",
  variant: "NORMAL",
  visualState: "ACTIVE" satisfies SoulState,
});

export const S08_AUDIO_CUE_ORDER = Object.freeze([
  "audio:scenes.s08.cue01",
  "audio:scenes.s08.cue02",
  "audio:scenes.s08.cue03",
  "audio:scenes.s08.cue04",
] as const);

export type S08AudioCue = (typeof S08_AUDIO_CUE_ORDER)[number];

export const S08_TIMING = FILM_TIMING.s08;

type NormalizedCrop = Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}>;

/**
 * Storytelling geometry measured from Screens/queen-cant-die.png (932x703).
 * The desktop reveal opens the same image surface from the right-side five-kill
 * evidence to the timestamp and earlier death. Mobile keeps the evidence at a
 * readable scale and reframes that surface toward the earlier-death detail.
 */
export const S08_SCREENSHOT = Object.freeze({
  source: Object.freeze({ width: 932, height: 703 }),
  fiveKills: Object.freeze({
    left: 580 / 932,
    top: 132 / 703,
    right: 0,
    bottom: 0,
  }) satisfies NormalizedCrop,
  deathReveal: Object.freeze({
    left: 39 / 932,
    top: 34 / 703,
    right: 0,
    bottom: 0,
  }) satisfies NormalizedCrop,
  mobileDeathReveal: Object.freeze({
    left: 39 / 932,
    top: 34 / 703,
    right: (932 - 480) / 932,
    bottom: (703 - 205) / 703,
  }) satisfies NormalizedCrop,
  killRowCenters: Object.freeze([164, 224, 284, 344, 665].map((y) => y / 703)),
  deathFocus: Object.freeze({
    left: 39 / 932,
    top: 78 / 703,
    width: 282 / 932,
    height: 52 / 703,
  }),
});

export function s08CropClipPath(crop: NormalizedCrop): string {
  const percent = (value: number) => `${(value * 100).toFixed(3)}%`;
  return `inset(${percent(crop.top)} ${percent(crop.right)} ${percent(crop.bottom)} ${percent(crop.left)})`;
}

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
