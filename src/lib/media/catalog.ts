import { loadMediaManifests } from "../assets/manifests";
import { assetUrl } from "../assets/paths";

import type { MediaAsset, MediaKind } from "./types";

type ManifestSource = "visual" | "audio";

const EXTENSION_KIND: Readonly<Record<string, MediaKind>> = {
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".mp4": "video",
  ".wav": "audio",
  ".mp3": "audio",
};

function getExtension(relativePath: string): string {
  const extensionIndex = relativePath.lastIndexOf(".");
  return extensionIndex >= 0
    ? relativePath.slice(extensionIndex).toLowerCase()
    : "";
}

export function classifyMediaPath(relativePath: string): MediaKind {
  const kind = EXTENSION_KIND[getExtension(relativePath)];

  if (!kind) {
    throw new Error(`Unsupported SOULBOUND media type: ${relativePath}`);
  }

  return kind;
}

function collectManifestMedia(
  value: unknown,
  source: ManifestSource,
  keys: readonly string[] = [],
  entries: Array<{ semanticRef: string; relativePath: string }> = [],
): Array<{ semanticRef: string; relativePath: string }> {
  if (typeof value === "string") {
    entries.push({
      semanticRef: `${source}:${keys.join(".")}`,
      relativePath: value,
    });
    return entries;
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      collectManifestMedia(child, source, [...keys, key], entries);
    }
  }

  return entries;
}

export class MediaCatalog {
  readonly #assets: readonly MediaAsset[];
  readonly #byId: ReadonlyMap<string, MediaAsset>;
  readonly #byUrl: ReadonlyMap<string, MediaAsset>;
  readonly #bySemanticRef: ReadonlyMap<string, MediaAsset>;

  constructor(visualManifest: unknown, audioManifest: unknown) {
    const manifestEntries = [
      ...collectManifestMedia(visualManifest, "visual"),
      ...collectManifestMedia(audioManifest, "audio"),
    ];
    const mutableByUrl = new Map<string, MediaAsset>();
    const semanticPathByRef = new Map<string, string>();

    for (const { semanticRef, relativePath } of manifestEntries) {
      const url = assetUrl(relativePath);
      const existing = mutableByUrl.get(url);
      semanticPathByRef.set(semanticRef, url);

      if (existing) {
        mutableByUrl.set(
          url,
          Object.freeze({
            ...existing,
            semanticRefs: Object.freeze([...existing.semanticRefs, semanticRef]),
          }),
        );
        continue;
      }

      mutableByUrl.set(
        url,
        Object.freeze({
          id: `media:${relativePath}`,
          relativePath,
          url,
          kind: classifyMediaPath(relativePath),
          semanticRefs: Object.freeze([semanticRef]),
        }),
      );
    }

    this.#assets = Object.freeze([...mutableByUrl.values()]);
    this.#byId = new Map(this.#assets.map((asset) => [asset.id, asset]));
    this.#byUrl = new Map(this.#assets.map((asset) => [asset.url, asset]));
    this.#bySemanticRef = new Map(
      [...semanticPathByRef].map(([semanticRef, url]) => [
        semanticRef,
        this.getByUrl(url),
      ]),
    );
  }

  getAll(): readonly MediaAsset[] {
    return this.#assets;
  }

  getById(id: string): MediaAsset {
    const asset = this.#byId.get(id);
    if (!asset) throw new Error(`Unknown SOULBOUND media asset ID: ${id}`);
    return asset;
  }

  getByUrl(url: string): MediaAsset {
    const asset = this.#byUrl.get(url);
    if (!asset) throw new Error(`Unknown SOULBOUND media URL: ${url}`);
    return asset;
  }

  getBySemanticRef(semanticRef: string): MediaAsset {
    const asset = this.#bySemanticRef.get(semanticRef);
    if (!asset) {
      throw new Error(`Unknown SOULBOUND semantic media reference: ${semanticRef}`);
    }
    return asset;
  }
}

let catalogPromise: Promise<MediaCatalog> | undefined;

export function loadMediaCatalog(): Promise<MediaCatalog> {
  catalogPromise ??= loadMediaManifests().then(
    ({ visual, audio }) => new MediaCatalog(visual, audio),
  );
  return catalogPromise;
}

export async function getMediaAsset(id: string): Promise<MediaAsset> {
  return (await loadMediaCatalog()).getById(id);
}

export async function getMediaAssetByUrl(url: string): Promise<MediaAsset> {
  return (await loadMediaCatalog()).getByUrl(url);
}

export async function getAllMediaAssets(): Promise<readonly MediaAsset[]> {
  return (await loadMediaCatalog()).getAll();
}
