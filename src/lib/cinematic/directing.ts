import type { MusicState } from "@/lib/audio/types";

/**
 * Phase 16 production timing and mix sheet.
 *
 * Values are linear gain coefficients and seconds. User bus preferences remain
 * independent and multiply these cinematic coefficients inside AudioEngine.
 */
export const CROSSFADE_PRESETS = Object.freeze({
  noneToNight: 3,
  nightToMemories: 5.2,
  memoriesToVulnerability: 6.2,
  vulnerabilityToZero: 1.6,
  zeroToHeartAndSoul: 5.4,
  heartAndSoulYesExpansion: 2.6,
  heartAndSoulThinkSettle: 1.4,
});

export const DUCK_PRESETS = Object.freeze({
  prologueAwakening: Object.freeze({ to: 0.74, attackSeconds: 0.08, holdSeconds: 0.72, releaseSeconds: 1.15 }),
  intimateNotification: Object.freeze({ to: 0.82, attackSeconds: 0.08, holdSeconds: 0.3, releaseSeconds: 0.85 }),
  morningReveal: Object.freeze({ to: 0.86, attackSeconds: 0.12, holdSeconds: 0.35, releaseSeconds: 1.05 }),
  queenArrival: Object.freeze({ to: 0.72, attackSeconds: 0.1, holdSeconds: 0.5, releaseSeconds: 1.35 }),
  queenDeclaration: Object.freeze({ to: 0.64, attackSeconds: 0.08, holdSeconds: 0.72, releaseSeconds: 1.65 }),
  painCompletion: Object.freeze({ to: 0.8, attackSeconds: 0.12, holdSeconds: 0.55, releaseSeconds: 1.35 }),
  voiceA: Object.freeze({ to: 0.6, attackSeconds: 0.12, holdSeconds: 3.85, releaseSeconds: 0.9 }),
  voiceB: Object.freeze({ to: 0.6, attackSeconds: 0.12, holdSeconds: 3.05, releaseSeconds: 0.9 }),
  voiceC: Object.freeze({ to: 0.6, attackSeconds: 0.12, holdSeconds: 2.2, releaseSeconds: 0.9 }),
});

export const FILM_TIMING = Object.freeze({
  prologue: Object.freeze({
    firstLine: 1.9,
    firstLineOut: 5.35,
    secondLine: 6.35,
    aside: 9.85,
    copyOut: 11.75,
    action: 13.05,
    awaken: 1.15,
    transition: 1.15,
  }),
  s01: Object.freeze({ screenshot: 0.5, firstLine: 3.2, secondLine: 7.35, settle: 9.6, collection: 11.7, continueDelay: 1.55, cameraPush: 21 }),
  s02: Object.freeze({ ordinaryOne: 0.8, ordinaryOneOut: 3.2, ordinaryTwo: 4.25, ordinaryTwoOut: 6.65, special: 7.75, firstLineAfterOpen: 1.2, secondLineAfterOpen: 3.05, collectionAfterOpen: 7.15, continueDelay: 1.45 }),
  s03: Object.freeze({ cameraDuration: 17.5, memoryOne: 2.8, memoryTwo: 7.1, memoryTwoPass: 8.75, memoryThree: 11.55, phraseOne: 18.05, phraseTwo: 20.8, collection: 25, continueDelay: 1.55, musicCrossfade: CROSSFADE_PRESETS.nightToMemories }),
  s04: Object.freeze({ memoryOneRecede: 0.35, memoryTwoRecede: 1.15, memoryThreeRecede: 1.95, phrase: 4.2, phraseOut: 8.1, collection: 9.05, continueDelay: 1.4, toneFrequency: 1650, tonePresence: 0.78, toneRamp: 1.9 }),
  s05: Object.freeze({ lightReveal: 1.65, screenshotReadable: 3.55, phraseOne: 5.25, phraseTwo: 8.05, finalBeat: 10.6, collection: 13.55, continueDelay: 1.55 }),
  s06: Object.freeze({ reveal: 1.25, first: 1.05, second: 3.35, third: 5.65, soulBeat: 7.8, collection: 9.65, continueDelay: 1.5 }),
  s07: Object.freeze({ stageReveal: 1.25, stillReveal: 0.7, videoReveal: 3.15, sincere: 4.75, ratingStart: 9.2, ratingDuration: 5.8, infinity: 15, hero: 15.45, aside: 18.1, collection: 21.55, continueDelay: 1.6 }),
  s08: Object.freeze({ entryReveal: 0.82, sigilPresence: 1.15, sigilActivation: 2.25, screenshot: 3.55, firstDeclaration: 5.15, fragments: 7.35, secondDeclaration: 9.85, deescalate: 11.9, collection: 14.35, continueDelay: 1.6 }),
  s09: Object.freeze({ entryReveal: 1.35, painReveal: 3.2, first: 5.6, second: 8.8, third: 13.7, interaction: 16.7, finalHold: 5.3, continueDelay: 1.75, exit: 1.15, musicCrossfade: CROSSFADE_PRESETS.memoriesToVulnerability }),
  s10: Object.freeze({ entryReveal: 2.3, first: 3.8, second: 7.6, calm: 12.4, calmHold: 3.45, fear: 17.25, loss: 22, interest: 25.1, finalFear: 28.2, finalHold: 5.05, collection: 34.6, hudSettle: 2, exit: 1.8, directMusicCrossfade: 3.5 }),
  preFinal: Object.freeze({ entryReveal: 1.8, first: 2, second: 5, third: 7.5, final: 12, finalHold: 4.3, continue: 16.8, exit: 1.1, directMusicCrossfade: 3.5 }),
  soulsRelease: Object.freeze({ musicFade: CROSSFADE_PRESETS.vulnerabilityToZero, detachStagger: 0.18, detachSpawn: 0.32, constellationFlight: 1.4, hudDisintegrateAt: 2.7, autoAdvance: 6.05, exit: 0.08 }),
  requiem: Object.freeze({ arrangement: 1.8, arrangementStagger: 0.055, scheduleLead: 0.2, ring1: 0.65, ring2: 1.5, ring3: 2.35, arcs: 3.15, contraction: 3.75, heroStart: 4.3 }),
  silence: Object.freeze({
    initialBlack: 2.4,
    lineFadeIn: 0.65,
    lineFadeOut: 0.58,
    cues: Object.freeze([
      Object.freeze({ revealAt: 2.4, hideAt: 4.62 }),
      Object.freeze({ revealAt: 5.22, hideAt: 7.44 }),
      Object.freeze({ revealAt: 8.04, hideAt: 10.62 }),
      Object.freeze({ revealAt: 12.12, hideAt: 15.08 }),
    ]),
    handoffAt: 16.95,
    exit: 0,
  }),
  final: Object.freeze({ awakening: 0.95, firstWords: 1.18, core: 4.2, secondWords: 4.5, merge: 7.3, mergeWord: 8.68, mergeConvergenceOffset: 2.76, full: 11.72, fullQuestionHold: 3.5, tag: 15.22, stable: 17.05, musicFadeIn: CROSSFADE_PRESETS.zeroToHeartAndSoul }),
  answer: Object.freeze({ revealDelayAfterFinalStable: 2.55 }),
  yes: Object.freeze({ stillness: 0.32, heartPulse: 0.32, soulEchoes: 0.75, release: 1.3, musicOpenDuration: CROSSFADE_PRESETS.heartAndSoulYesExpansion, releaseSettle: 4.75, resolve: 5, dateReveal: 7.25, stable: 12.2 }),
  think: Object.freeze({ stillness: 0.3, controlsGone: 0.84, calm: 1.5, stable: 2.8 }),
});

export const COLLECTION_TIMING = Object.freeze({
  NORMAL: Object.freeze({ glow: 0.5, fragment: 0.58, gather: 0.56, spawn: 0.66, stabilize: 0.3, flight: 0.82, absorb: 0.32 }),
  SILENT: Object.freeze({ glow: 0.55, fragment: 0.63, gather: 0.6, spawn: 0.7, stabilize: 0.34, flight: 0.88, absorb: 0.34 }),
  DEEP: Object.freeze({ glow: 0.72, fragment: 0.82, gather: 0.84, spawn: 0.9, stabilize: 0.5, flight: 1.16, absorb: 0.5 }),
});

export const COLLECTION_SCENE_SCALE = Object.freeze({
  S01: 1.04, S02: 0.96, S03: 1.02, S04: 1, S05: 0.98,
  S06: 0.94, S07: 0.9, S08: 1.02, S09: 1, S10: 1.04,
});

export const FILM_MIX = Object.freeze({
  music: Object.freeze({
    prologue: 0.42, s01: 0.42, s02: 0.42, s03: 0.56, s04: 0.44,
    s05: 0.54, s06: 0.56, s07: 0.58, s08: 0.5, s09: 0.4,
    s10: 0.32, preFinal: 0.2, finalPreAnswer: 0.34, yes: 0.6, think: 0.4,
  }),
  ambient: Object.freeze({ s01Room: 0.1, s03Memory: 0.1, s05Morning: 0.09, s09Drone: 0.18, s09Rain: 0.26 }),
  sfx: Object.freeze({
    prologueAwakening: 0.68,
    s02Ordinary: 0.48, s02Warm: 0.58, s02Open: 0.56,
    s03Memory: 0.42, s03Pass: 0.34,
    s05Reveal: 0.44, s05PianoA: 0.38, s05PianoB: 0.36, s05PianoC: 0.4,
    s06Heart: 0.48,
    s07Arrival: 0.42, s07RatingRise: 0.024, s07Resolve: 0.48, s07Pop: 0.22,
    s08Arrival: 0.56, s08Sigil: 0.38, s08Fragments: 0.42, s08Declaration: 0.6,
    s09AbsorptionPeak: 0.24, s09FracturedLight: 0.2, s09Completion: 0.38,
    releaseFly: 0.09,
    requiemRing1: 0.44, requiemRing2: 0.46, requiemRing3: 0.48, requiemArcs: 0.72, requiemHero: 0.74,
    finalAwakening: 0.74, finalMerge: 0.76, finalHalo: 0.72,
    yesRelease: 0.62, yesResolve: 0.58,
  }),
  collection: Object.freeze({
    normalSpawn: 0.66, normalFly: 0.52, deepSpawn: 0.5, deepFly: 0.42,
    absorptionToneNormal: 0.022, absorptionToneDeep: 0.016,
  }),
  voice: Object.freeze({ A: 0.8, B: 0.8, C: 0.92 }),
  finalTone: Object.freeze({ frequency: 10_500, presence: 0.86 }),
});

export type MusicCue = Readonly<{
  id: string;
  scene: string;
  state: MusicState | null;
  gain: number;
  crossfadeSeconds: number;
  restart: boolean;
}>;

export const MUSIC_CUE_SEQUENCE: readonly MusicCue[] = Object.freeze([
  Object.freeze({ id: "OPEN_SOUL", scene: "PROLOGUE", state: "NIGHT", gain: FILM_MIX.music.prologue, crossfadeSeconds: CROSSFADE_PRESETS.noneToNight, restart: false }),
  Object.freeze({ id: "WARM_MEMORIES", scene: "S03", state: "MEMORIES", gain: FILM_MIX.music.s03, crossfadeSeconds: CROSSFADE_PRESETS.nightToMemories, restart: false }),
  Object.freeze({ id: "PAIN", scene: "S09", state: "VULNERABILITY", gain: FILM_MIX.music.s09, crossfadeSeconds: CROSSFADE_PRESETS.memoriesToVulnerability, restart: false }),
  Object.freeze({ id: "RELEASE_ZERO", scene: "SOULS_RELEASE", state: null, gain: 0, crossfadeSeconds: CROSSFADE_PRESETS.vulnerabilityToZero, restart: false }),
  Object.freeze({ id: "FINAL_REBUILD", scene: "FINAL", state: "HEART_AND_SOUL", gain: FILM_MIX.music.finalPreAnswer, crossfadeSeconds: CROSSFADE_PRESETS.zeroToHeartAndSoul, restart: true }),
  Object.freeze({ id: "YES_EXPANSION", scene: "YES", state: "HEART_AND_SOUL", gain: FILM_MIX.music.yes, crossfadeSeconds: CROSSFADE_PRESETS.heartAndSoulYesExpansion, restart: false }),
  Object.freeze({ id: "THINK_SETTLE", scene: "THINK", state: "HEART_AND_SOUL", gain: FILM_MIX.music.think, crossfadeSeconds: CROSSFADE_PRESETS.heartAndSoulThinkSettle, restart: false }),
]);

export function linearGainToDb(gain: number): number {
  return gain === 0 ? Number.NEGATIVE_INFINITY : 20 * Math.log10(gain);
}
