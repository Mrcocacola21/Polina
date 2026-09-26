import type { SoulClaimStage, SoulClaimTrigger } from "./types";

export type SoulClaimState = Readonly<{
  stage: SoulClaimStage;
  locked: boolean;
  trigger: SoulClaimTrigger | null;
}>;

export function createSoulClaimState(): SoulClaimState {
  return { stage: "FORMING", locked: false, trigger: null };
}

export function enterSoulWaiting(state: SoulClaimState): SoulClaimState {
  return state.stage === "FORMING" ? { ...state, stage: "WAITING" } : state;
}

export function claimSoul(
  state: SoulClaimState,
  trigger: SoulClaimTrigger,
): Readonly<{ accepted: boolean; state: SoulClaimState }> {
  if (state.stage !== "WAITING" || state.locked) return { accepted: false, state };
  return {
    accepted: true,
    state: { stage: "CLAIMED", locked: true, trigger },
  };
}

export function advanceSoulClaim(
  state: SoulClaimState,
  stage: Extract<SoulClaimStage, "FLYING" | "ABSORBING" | "COMMITTED">,
): SoulClaimState {
  const allowed =
    (state.stage === "CLAIMED" && stage === "FLYING") ||
    (state.stage === "FLYING" && stage === "ABSORBING") ||
    (state.stage === "ABSORBING" && stage === "COMMITTED");
  return allowed ? { ...state, stage } : state;
}

export function cancelSoulClaim(state: SoulClaimState): SoulClaimState {
  if (state.stage === "COMMITTED" || state.stage === "CANCELLED") return state;
  return { ...state, stage: "CANCELLED", locked: true };
}
