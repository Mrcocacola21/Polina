import type { MusicState } from "@/lib/audio/types";
import type { CollectionResultStatus, SoulSlotStatus, SoulVoice } from "@/lib/souls/types";
import type { SoulState } from "@/lib/visuals/types";

import { FILM_MIX, FILM_TIMING } from "./directing";

export const S09_COPY = Object.freeze({
  full: "Когда ты чувствуешь себя плохо, я честно стараюсь каждый раз тебя хоть как-то пожалеть или подбодрить, и если бы это было возможно - забрать всю боль, что ты чувствуешь",
  first: "Когда ты чувствуешь себя плохо,",
  second: "я честно стараюсь каждый раз тебя хоть как-то пожалеть или подбодрить,",
  third: "и если бы это было возможно -",
  final: "забрать всю боль, что ты чувствуешь",
});

export const PHASE10_MUSIC_STATE = "VULNERABILITY" satisfies MusicState;

export const S09_COLLECTION = Object.freeze({
  soulId: "SOUL_09",
  source: "POINT",
  variant: "DEEP",
  visualState: "ACTIVE" satisfies SoulState,
  voice: "NONE" satisfies SoulVoice,
});

export const S09_AUDIO = Object.freeze({
  drone: "PAIN_DRONE",
  rain: "SPARSE_RAIN",
  fracturedLight: "audio:scenes.s09.cue03",
  absorption: "audio:scenes.s09.cue04",
  completion: "audio:scenes.s09.cue05",
});

export const ABSORB_DURATION = 2.5;
export const ABSORB_RELEASE_DECAY = 1.25;

export const S09_TIMING = FILM_TIMING.s09;

export const S09_MIX = Object.freeze({
  drone: FILM_MIX.ambient.s09Drone,
  rain: FILM_MIX.ambient.s09Rain,
  absorptionPeak: FILM_MIX.sfx.s09AbsorptionPeak,
  fracturedLight: FILM_MIX.sfx.s09FracturedLight,
  completion: FILM_MIX.sfx.s09Completion,
});

export const S09_VISUAL_LEVELS = Object.freeze({
  fogResting: 0.72,
  fogCompleted: 0.46,
  particleRestingOpacity: 0.14,
  particlePeakOpacity: 0.42,
  cameraScale: 1.022,
});

export type PainAbsorptionState = "idle" | "holding" | "releasing" | "completed" | "cancelled";

export type PainAbsorptionSnapshot = Readonly<{
  progress: number;
  state: PainAbsorptionState;
  completed: boolean;
}>;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Pure monotonic-time controller. DOM, sound, and visuals consume its one progress value. */
export class PainAbsorptionController {
  readonly holdDuration: number;
  readonly releaseDecay: number;
  #progress = 0;
  #held = false;
  #completed = false;
  #cancelled = false;
  #lastTime: number | null = null;

  constructor(holdDuration = ABSORB_DURATION, releaseDecay = ABSORB_RELEASE_DECAY) {
    this.holdDuration = Math.max(0.001, holdDuration);
    this.releaseDecay = Math.max(0.001, releaseDecay);
  }

  startHold(now: number): PainAbsorptionSnapshot {
    if (this.#completed || this.#cancelled) return this.snapshot();
    this.#advance(now);
    this.#held = true;
    return this.snapshot();
  }

  endHold(now: number): PainAbsorptionSnapshot {
    if (this.#completed || this.#cancelled) return this.snapshot();
    this.#advance(now);
    this.#held = false;
    return this.snapshot();
  }

  tick(now: number): PainAbsorptionSnapshot {
    this.#advance(now);
    return this.snapshot();
  }

  cancel(): PainAbsorptionSnapshot {
    this.#held = false;
    this.#cancelled = true;
    this.#progress = 0;
    this.#lastTime = null;
    return this.snapshot();
  }

  snapshot(): PainAbsorptionSnapshot {
    return {
      progress: this.#progress,
      state: this.#cancelled
        ? "cancelled"
        : this.#completed
          ? "completed"
          : this.#held
            ? "holding"
            : this.#progress > 0
              ? "releasing"
              : "idle",
      completed: this.#completed,
    };
  }

  #advance(now: number): void {
    if (this.#completed || this.#cancelled || !Number.isFinite(now)) return;
    if (this.#lastTime === null) {
      this.#lastTime = now;
      return;
    }
    const elapsed = Math.max(0, now - this.#lastTime) / 1000;
    this.#lastTime = now;
    if (this.#held) {
      this.#progress = clamp01(this.#progress + elapsed / this.holdDuration);
      if (this.#progress >= 1) {
        this.#progress = 1;
        this.#completed = true;
        this.#held = false;
      }
    } else {
      this.#progress = clamp01(this.#progress - elapsed / this.releaseDecay);
    }
  }
}

export function mapS09Fog(progress: number): number {
  const normalized = clamp01(progress);
  return S09_VISUAL_LEVELS.fogResting +
    (S09_VISUAL_LEVELS.fogCompleted - S09_VISUAL_LEVELS.fogResting) * normalized;
}

export function phase10CollectionAllowsContinue(status: CollectionResultStatus): boolean {
  return status === "collected" || status === "already-collected";
}

export function isS09AlreadyCommitted(status: SoulSlotStatus | undefined): boolean {
  return status === "COLLECTED" || status === "RELEASED";
}
