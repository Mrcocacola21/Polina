import type { MusicState } from "@/lib/audio/types";
import type { CollectionResultStatus, SoulVoice } from "@/lib/souls/types";
import type { SoulState } from "@/lib/visuals/types";

export const S03_COPY = Object.freeze({
  full: "Я бы хотел разделять с тобой каждый момент этой жизни, они меня делают счастливыми",
  first: "Я бы хотел разделять с тобой каждый момент этой жизни,",
  second: "они меня делают счастливыми",
});

export const S04_COPY = Object.freeze({
  full: "Я слишком быстро соскучиваюсь по тебе",
});

export const S05_COPY = Object.freeze({
  full: "Когда я просыпаюсь и вижу доброе утро от тебя, мое утро становится по-истинну добрым",
  first: "Когда я просыпаюсь и вижу доброе утро от тебя,",
  secondLead: "мое утро становится по-истинну ",
  finalWord: "добрым",
});

export const PHASE7_MUSIC_STATE = "MEMORIES" satisfies MusicState;

export const S03_COLLECTION = Object.freeze({
  soulId: "SOUL_03",
  source: "POINTS",
  variant: "NORMAL",
  visualState: "ACTIVE" satisfies SoulState,
  voice: "B" satisfies SoulVoice,
});

export const S04_COLLECTION = Object.freeze({
  soulId: "SOUL_04",
  source: "POINT",
  variant: "SILENT",
  visualState: "ACTIVE" satisfies SoulState,
  voice: "NONE" satisfies SoulVoice,
});

export const S05_COLLECTION = Object.freeze({
  soulId: "SOUL_05",
  source: "POINT",
  variant: "NORMAL",
  visualState: "ACTIVE" satisfies SoulState,
  voice: "NONE" satisfies SoulVoice,
});

export const S03_TIMING = Object.freeze({
  cameraDuration: 17.5,
  memoryOne: 2.8,
  memoryTwo: 7.1,
  memoryTwoPass: 8.65,
  memoryThree: 11.45,
  phraseOne: 18.15,
  phraseTwo: 20.9,
  collection: 24.6,
  continueDelay: 1.45,
  musicCrossfade: 5,
});

export const S04_TIMING = Object.freeze({
  memoryOneRecede: 0.35,
  memoryTwoRecede: 1.15,
  memoryThreeRecede: 1.95,
  phrase: 4.35,
  phraseOut: 8.25,
  collection: 9.15,
  continueDelay: 1.35,
  toneFrequency: 1450,
  tonePresence: 0.72,
  toneRamp: 1.8,
});

export const S05_TIMING = Object.freeze({
  lightReveal: 1.6,
  screenshotReadable: 3.4,
  phraseOne: 5.15,
  phraseTwo: 7.95,
  finalBeat: 10.45,
  collection: 13.25,
  continueDelay: 1.45,
});

export type MemoryCameraFrame = Readonly<{
  x: number;
  y: number;
  z: number;
  yaw: number;
  roll: number;
}>;

const MEMORY_CAMERA_POINTS: readonly MemoryCameraFrame[] = Object.freeze([
  { x: 0, y: 10, z: -540, yaw: 0, roll: 0 },
  { x: 95, y: -20, z: -250, yaw: -0.8, roll: -0.25 },
  { x: -135, y: 42, z: 10, yaw: 1.15, roll: 0.35 },
  { x: 82, y: -35, z: 250, yaw: -0.72, roll: -0.2 },
  { x: 0, y: 0, z: 420, yaw: 0, roll: 0 },
]);

function catmullRom(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

export function evaluateMemoryCameraSpline(progress: number): MemoryCameraFrame {
  const clamped = Math.min(1, Math.max(0, progress));
  const last = MEMORY_CAMERA_POINTS.length - 1;
  const scaled = clamped * last;
  const segment = Math.min(last - 1, Math.floor(scaled));
  const local = segment === last ? 1 : scaled - segment;
  const p0 = MEMORY_CAMERA_POINTS[Math.max(0, segment - 1)];
  const p1 = MEMORY_CAMERA_POINTS[segment];
  const p2 = MEMORY_CAMERA_POINTS[Math.min(last, segment + 1)];
  const p3 = MEMORY_CAMERA_POINTS[Math.min(last, segment + 2)];
  return {
    x: catmullRom(p0.x, p1.x, p2.x, p3.x, local),
    y: catmullRom(p0.y, p1.y, p2.y, p3.y, local),
    z: catmullRom(p0.z, p1.z, p2.z, p3.z, local),
    yaw: catmullRom(p0.yaw, p1.yaw, p2.yaw, p3.yaw, local),
    roll: catmullRom(p0.roll, p1.roll, p2.roll, p3.roll, local),
  };
}

export function createInteractionLock(): () => boolean {
  let activated = false;
  return () => {
    if (activated) return false;
    activated = true;
    return true;
  };
}

export function phase7CollectionAllowsContinue(
  status: CollectionResultStatus,
): boolean {
  return status === "collected" || status === "already-collected";
}
