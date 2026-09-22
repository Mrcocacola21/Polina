import { loadMediaCatalog, type MediaCatalog } from "../media/catalog";
import type { MediaAsset } from "../media/types";
import audioMap from "./audio-map.json";
import type { AmbientState, MusicState, VoiceLineId } from "./types";

export const MUSIC_STATES = [
  "NIGHT",
  "MEMORIES",
  "VULNERABILITY",
  "HEART_AND_SOUL",
] as const satisfies readonly MusicState[];

export const AMBIENT_STATES = [
  "LATE_NIGHT_ROOM",
  "MEMORY_SPACE",
  "MORNING_ROOM",
  "PAIN_DRONE",
  "SPARSE_RAIN",
] as const satisfies readonly AmbientState[];

const musicRefs: Readonly<Record<MusicState, string>> = audioMap.music;
const ambientRefs: Readonly<Record<AmbientState, string>> = audioMap.ambient;
const voiceRefs: Readonly<Record<VoiceLineId, string>> = audioMap.voice;

function requireAudio(asset: MediaAsset, semanticId: string): MediaAsset {
  if (asset.kind !== "audio") {
    throw new Error(`SOULBOUND audio mapping is not audio: ${semanticId}`);
  }
  return asset;
}

export class AudioCatalog {
  readonly #mediaCatalog: MediaCatalog;
  readonly #all: readonly MediaAsset[];
  readonly #longFormIds: ReadonlySet<string>;

  constructor(mediaCatalog: MediaCatalog) {
    this.#mediaCatalog = mediaCatalog;
    this.#all = Object.freeze(
      mediaCatalog.getAll().filter((asset) => asset.kind === "audio"),
    );
    this.#longFormIds = new Set([
      ...Object.values(musicRefs).map((ref) => this.getBySemanticRef(ref).id),
      ...Object.values(ambientRefs).map((ref) => this.getBySemanticRef(ref).id),
    ]);
  }

  getAll(): readonly MediaAsset[] {
    return this.#all;
  }

  getShortSfx(): readonly MediaAsset[] {
    return this.#all.filter((asset) => !this.#longFormIds.has(asset.id));
  }

  getById(id: string): MediaAsset {
    return requireAudio(this.#mediaCatalog.getById(id), id);
  }

  getBySemanticRef(ref: string): MediaAsset {
    return requireAudio(this.#mediaCatalog.getBySemanticRef(ref), ref);
  }

  getMusic(state: MusicState): MediaAsset {
    return this.getBySemanticRef(musicRefs[state]);
  }

  getAmbient(state: AmbientState): MediaAsset {
    return this.getBySemanticRef(ambientRefs[state]);
  }

  getVoiceLine(id: VoiceLineId): MediaAsset {
    return this.getBySemanticRef(voiceRefs[id]);
  }

  getRequiem(): MediaAsset {
    return this.getBySemanticRef(audioMap.requiem);
  }

  isLongForm(asset: MediaAsset): boolean {
    return this.#longFormIds.has(asset.id);
  }
}

let audioCatalogPromise: Promise<AudioCatalog> | undefined;

export function loadAudioCatalog(): Promise<AudioCatalog> {
  audioCatalogPromise ??= loadMediaCatalog().then(
    (catalog) => new AudioCatalog(catalog),
  );
  return audioCatalogPromise;
}
