import { assetUrl } from "./paths";
import type { AudioManifest, VisualManifest } from "./types";

export type MediaManifests = Readonly<{
  visual: VisualManifest;
  audio: AudioManifest;
}>;

let mediaManifestsPromise: Promise<MediaManifests> | undefined;

function isManifestNode(value: unknown): boolean {
  if (typeof value === "string") {
    return value.length > 0;
  }

  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(isManifestNode);
}

async function loadManifest<T>(
  filename: string,
  label: string,
  signal?: AbortSignal,
): Promise<T> {
  const url = assetUrl(filename);
  let response: Response;

  try {
    response = await fetch(url, { cache: "no-store", signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }

    throw new Error(`Unable to load the ${label} manifest from ${url}.`, {
      cause: error,
    });
  }

  if (!response.ok) {
    throw new Error(
      `Unable to load the ${label} manifest from ${url}: ${response.status} ${response.statusText}.`,
    );
  }

  let data: unknown;

  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`The ${label} manifest at ${url} is not valid JSON.`, {
      cause: error,
    });
  }

  if (
    data === null ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !isManifestNode(data)
  ) {
    throw new Error(`The ${label} manifest at ${url} has an invalid structure.`);
  }

  return data as T;
}

export function loadVisualManifest(signal?: AbortSignal): Promise<VisualManifest> {
  return loadManifest<VisualManifest>("manifest.json", "visual", signal);
}

export function loadAudioManifest(signal?: AbortSignal): Promise<AudioManifest> {
  return loadManifest<AudioManifest>("audio-manifest.json", "audio", signal);
}

export function loadMediaManifests(): Promise<MediaManifests> {
  mediaManifestsPromise ??= Promise.all([
    loadVisualManifest(),
    loadAudioManifest(),
  ])
    .then(([visual, audio]) => ({ visual, audio }))
    .catch((error: unknown) => {
      mediaManifestsPromise = undefined;
      throw error;
    });

  return mediaManifestsPromise;
}
