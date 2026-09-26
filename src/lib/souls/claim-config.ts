import type { SoulId } from "./registry";
import type { SoulVoice } from "./types";

export const SOUL_WAITING_AUDIO = "audio:global.soulSpawn" as const;
export const SOUL_CLAIM_AUDIO = "audio:global.soulFly" as const;

export type SoulClaimConfig = Readonly<{
  mode: "EXPLICIT";
  idleAudio: typeof SOUL_WAITING_AUDIO;
  collectAudio: typeof SOUL_CLAIM_AUDIO;
  voice: SoulVoice;
  hitRadius: number;
}>;

const define = (voice: SoulVoice, hitRadius = 54): SoulClaimConfig => Object.freeze({
  mode: "EXPLICIT",
  idleAudio: SOUL_WAITING_AUDIO,
  collectAudio: SOUL_CLAIM_AUDIO,
  voice,
  hitRadius,
});

/** The sole authoritative production mapping for explicit Soul claims. */
export const SOUL_CLAIM_CONFIG = Object.freeze({
  SOUL_01: define("A"),
  SOUL_02: define("NONE"),
  SOUL_03: define("B"),
  SOUL_04: define("NONE"),
  SOUL_05: define("NONE"),
  SOUL_06: define("C"),
  SOUL_07: define("NONE"),
  SOUL_08: define("A"),
  SOUL_09: define("NONE", 58),
  SOUL_10: define("NONE", 58),
} satisfies Readonly<Record<SoulId, SoulClaimConfig>>);

export function getSoulClaimConfig(soulId: SoulId): SoulClaimConfig {
  return SOUL_CLAIM_CONFIG[soulId];
}
