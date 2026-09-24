import { SOUL_IDS, type SoulId } from "../souls/registry";

import cueMetadata from "./requiem-cues.json";

export const REQUIEM_SOUL_IDS = SOUL_IDS;

export const SOULS_RELEASE_TIMING = Object.freeze({
  musicFade: 1.4,
  detachStagger: 0.18,
  detachSpawn: 0.32,
  constellationFlight: 1.35,
  hudDisintegrateAt: 2.65,
  autoAdvance: 5.8,
  exit: 0.08,
});

export const REQUIEM_BUILDUP_TIMING = Object.freeze({
  arrangement: 1.75,
  arrangementStagger: 0.055,
  scheduleLead: 0.18,
  ring1: 0.55,
  ring2: 1.35,
  ring3: 2.15,
  arcs: 2.9,
  contraction: 3.48,
  heroStart: 4.05,
});

export const REQUIEM_RADIAL_CONFIG = Object.freeze({
  startAngle: -Math.PI / 2,
  radiusRatio: 0.31,
  contractedRatio: 0.92,
  exitRatio: 0.78,
});

export const REQUIEM_AUDIO = Object.freeze({
  ring1: "audio:requiem.ring1",
  ring2: "audio:requiem.ring2",
  ring3: "audio:requiem.ring3",
  arcs: "audio:requiem.energyArcs",
  hero: "audio:requiem.fullRequiem",
});

export const REQUIEM_AUDIO_CUES = Object.freeze({
  sourceAssetId: cueMetadata.sourceAssetId,
  sourcePath: cueMetadata.sourcePath,
  sha256: cueMetadata.sha256,
  duration: cueMetadata.duration,
  analysisWindowMs: cueMetadata.analysisWindowMs,
  envelopeStepMs: cueMetadata.envelopeStepMs,
  cues: Object.freeze({ ...cueMetadata.cues }),
  normalizedRmsEnvelope: Object.freeze([...cueMetadata.normalizedRmsEnvelope]),
});

export type RequiemCueName = keyof typeof REQUIEM_AUDIO_CUES.cues;

export type RadialPosition = Readonly<{
  soulId: SoulId;
  index: number;
  angle: number;
  x: number;
  y: number;
  unitX: number;
  unitY: number;
}>;

export function releasePreconditionMet(count: number, total = REQUIEM_SOUL_IDS.length): boolean {
  return count === total && total === 10;
}

export function calculateRadialPositions(
  width: number,
  height: number,
  radiusRatio: number = REQUIEM_RADIAL_CONFIG.radiusRatio,
): readonly RadialPosition[] {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const radius = Math.min(safeWidth, safeHeight) * radiusRatio;
  return REQUIEM_SOUL_IDS.map((soulId, index) => {
    const angle = REQUIEM_RADIAL_CONFIG.startAngle + index * Math.PI * 2 / REQUIEM_SOUL_IDS.length;
    const unitX = Math.cos(angle);
    const unitY = Math.sin(angle);
    return {
      soulId,
      index,
      angle,
      x: safeWidth / 2 + unitX * radius,
      y: safeHeight / 2 + unitY * radius,
      unitX,
      unitY,
    };
  });
}

export class RequiemClock {
  readonly #heroStartTime: number;
  readonly #runId: number;
  readonly #fired = new Set<RequiemCueName>();
  #previousElapsed = Number.NEGATIVE_INFINITY;

  constructor(heroStartTime: number, runId: number) {
    this.#heroStartTime = heroStartTime;
    this.#runId = runId;
  }

  get heroStartTime(): number {
    return this.#heroStartTime;
  }

  tick(audioContextTime: number, runId: number): readonly RequiemCueName[] {
    if (runId !== this.#runId || !Number.isFinite(audioContextTime)) return [];
    const elapsed = audioContextTime - this.#heroStartTime;
    const crossed: RequiemCueName[] = [];
    for (const [name, at] of Object.entries(REQUIEM_AUDIO_CUES.cues) as Array<[RequiemCueName, number]>) {
      if (!this.#fired.has(name) && this.#previousElapsed < at && elapsed >= at) {
        this.#fired.add(name);
        crossed.push(name);
      }
    }
    this.#previousElapsed = Math.max(this.#previousElapsed, elapsed);
    return crossed;
  }

  hasFired(name: RequiemCueName): boolean {
    return this.#fired.has(name);
  }

  reset(): void {
    this.#fired.clear();
    this.#previousElapsed = Number.NEGATIVE_INFINITY;
  }
}

export function sampleRequiemEnvelope(elapsedSeconds: number): number {
  const values = REQUIEM_AUDIO_CUES.normalizedRmsEnvelope;
  const position = Math.max(0, elapsedSeconds * 1000 / REQUIEM_AUDIO_CUES.envelopeStepMs);
  const lower = Math.min(values.length - 1, Math.floor(position));
  const upper = Math.min(values.length - 1, lower + 1);
  const mix = position - lower;
  return values[lower] * (1 - mix) + values[upper] * mix;
}

export const SILENCE_BOUNDARY_CONTENT = "";
