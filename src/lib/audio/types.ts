import type { MediaAsset } from "../media/types";

export const AUDIO_BUS_NAMES = [
  "music",
  "ambient",
  "sfx",
  "procedural",
] as const;

export type AudioBusName = (typeof AUDIO_BUS_NAMES)[number];
export type VolumeName = "master" | AudioBusName;
export type MusicState =
  | "NIGHT"
  | "MEMORIES"
  | "VULNERABILITY"
  | "HEART_AND_SOUL";
export type AmbientState =
  | "LATE_NIGHT_ROOM"
  | "MEMORY_SPACE"
  | "MORNING_ROOM"
  | "PAIN_DRONE"
  | "SPARSE_RAIN";
export type VoiceLineId = "A" | "B" | "C";
export type AudioScopeId = string;
export type EngineContextState =
  | "locked"
  | "suspended"
  | "running"
  | "interrupted"
  | "closed"
  | "unavailable";

export type AudioLevels = Readonly<Record<VolumeName, number>>;

export type MusicSnapshot = Readonly<{
  state: MusicState | null;
  assetId: string | null;
  deck: "A" | "B" | null;
  playing: boolean;
  paused: boolean;
  currentTime: number;
  duration: number | null;
}>;

export type AudioEngineSnapshot = Readonly<{
  contextState: EngineContextState;
  contextCreationCount: number;
  isUnlocked: boolean;
  isMuted: boolean;
  levels: AudioLevels;
  effectiveDucks: Readonly<Record<AudioBusName, number>>;
  music: MusicSnapshot;
  activeMusicDeckCount: number;
  activeAmbientCount: number;
  activeSfxCount: number;
  activeProceduralCount: number;
  activeScopeCount: number;
  activeDuckCount: number;
  decodedSfxCount: number;
  lastError: string | null;
}>;

export type UnlockAudioResult =
  | Readonly<{ ok: true; state: EngineContextState }>
  | Readonly<{ ok: false; state: EngineContextState; error: string }>;

export type StopOptions = Readonly<{ fadeSeconds?: number }>;

export interface AudioHandle {
  readonly id: string;
  readonly kind: "ambient" | "sfx" | "procedural";
  stop(options?: StopOptions): void;
  isActive(): boolean;
}

export interface GainAudioHandle extends AudioHandle {
  setGain(value: number, rampSeconds?: number): void;
}

export interface SfxHandle extends GainAudioHandle {
  readonly kind: "sfx";
  setPan(value: number, rampSeconds?: number): void;
  setPlaybackRate(value: number): void;
}

export interface AmbientHandle extends GainAudioHandle {
  readonly kind: "ambient";
  setPlaybackRate(value: number): void;
}

export interface ProceduralHandle extends GainAudioHandle {
  readonly kind: "procedural";
}

export interface PulseHandle extends ProceduralHandle {
  triggerPulse(): void;
}

export interface DuckHandle {
  readonly id: string;
  readonly bus: AudioBusName;
  release(releaseSeconds?: number): void;
  isActive(): boolean;
}

export type MusicOptions = Readonly<{
  crossfadeSeconds?: number;
  restart?: boolean;
  loop?: boolean;
}>;

export type AmbientOptions = Readonly<{
  loop?: boolean;
  gain?: number;
  playbackRate?: number;
  fadeInSeconds?: number;
  scopeId?: AudioScopeId;
}>;

export type DuckOptions = Readonly<{
  to?: number;
  attackSeconds?: number;
  holdSeconds?: number;
  releaseSeconds?: number;
  scopeId?: AudioScopeId;
}>;

export type SfxOptions = Readonly<{
  gain?: number;
  pan?: number;
  playbackRate?: number;
  delaySeconds?: number;
  scopeId?: AudioScopeId;
  duckMusic?: boolean | DuckOptions;
}>;

export type LowRumbleOptions = Readonly<{
  intensity?: number;
  frequency?: number;
  gain?: number;
  scopeId?: AudioScopeId;
}>;

export type FilteredNoiseOptions = Readonly<{
  filterFrequency?: number;
  q?: number;
  gain?: number;
  scopeId?: AudioScopeId;
}>;

export type UiToneOptions = Readonly<{
  frequency?: number;
  durationSeconds?: number;
  gain?: number;
  waveform?: OscillatorType;
  scopeId?: AudioScopeId;
}>;

export type RatingRiseOptions = Readonly<{
  startFrequency?: number;
  endFrequency?: number;
  durationSeconds?: number;
  gain?: number;
  scopeId?: AudioScopeId;
}>;

export type SoulHumOptions = Readonly<{
  baseFrequency?: number;
  intensity?: number;
  gain?: number;
  scopeId?: AudioScopeId;
}>;

export type AudioAsset = MediaAsset;
