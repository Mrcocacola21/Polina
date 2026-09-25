import type {
  MediaAsset,
  MediaFailure,
  MediaLoaders,
} from "./types";

export const DEFAULT_MEDIA_LOAD_TIMEOUT_MS = 30_000;

export class MediaPreloadError extends Error {
  readonly retryable: boolean;
  readonly statusCode?: number;

  constructor(
    message: string,
    options: { retryable: boolean; statusCode?: number; cause?: unknown },
  ) {
    super(message, { cause: options.cause });
    this.name = "MediaPreloadError";
    this.retryable = options.retryable;
    this.statusCode = options.statusCode;
  }
}

export function toMediaFailure(error: unknown): MediaFailure {
  if (error instanceof MediaPreloadError) {
    return {
      message: error.message,
      retryable: error.retryable,
      statusCode: error.statusCode,
    };
  }

  return {
    message: error instanceof Error ? error.message : "Unknown media load error.",
    retryable: true,
  };
}

export async function preloadImage(asset: MediaAsset): Promise<void> {
  if (typeof Image === "undefined") {
    throw new MediaPreloadError("Image loading requires a browser environment.", {
      retryable: false,
    });
  }

  const image = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        window.clearTimeout(timeoutId);
        image.removeEventListener("load", handleLoad);
        image.removeEventListener("error", handleError);
      };
      const handleLoad = () => {
        cleanup();
        resolve();
      };
      const handleError = () => {
        cleanup();
        reject(
          new MediaPreloadError(`Image failed to load: ${asset.url}`, {
            retryable: true,
          }),
        );
      };
      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(
          new MediaPreloadError(`Image preparation timed out: ${asset.url}`, {
            retryable: true,
          }),
        );
      }, DEFAULT_MEDIA_LOAD_TIMEOUT_MS);

      image.addEventListener("load", handleLoad, { once: true });
      image.addEventListener("error", handleError, { once: true });
      image.decoding = "async";
      image.src = asset.url;

      if (image.complete) {
        if (image.naturalWidth > 0) handleLoad();
        else handleError();
      }
    });

    if (typeof image.decode === "function") {
      try {
        await image.decode();
      } catch (error) {
        throw new MediaPreloadError(`Image failed to decode: ${asset.url}`, {
          retryable: true,
          cause: error,
        });
      }
    }
  } finally {
    image.removeAttribute("src");
  }
}

export async function preloadVideo(asset: MediaAsset): Promise<void> {
  if (typeof document === "undefined") {
    throw new MediaPreloadError("Video loading requires a browser environment.", {
      retryable: false,
    });
  }

  const video = document.createElement("video");
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = "auto";

  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        window.clearTimeout(timeoutId);
        video.removeEventListener("loadeddata", handleReady);
        video.removeEventListener("error", handleError);
      };
      const handleReady = () => {
        cleanup();
        resolve();
      };
      const handleError = () => {
        cleanup();
        reject(
          new MediaPreloadError(`Video failed to prepare: ${asset.url}`, {
            retryable: true,
          }),
        );
      };
      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(
          new MediaPreloadError(`Video preparation timed out: ${asset.url}`, {
            retryable: true,
          }),
        );
      }, DEFAULT_MEDIA_LOAD_TIMEOUT_MS);

      video.addEventListener("loadeddata", handleReady, { once: true });
      video.addEventListener("error", handleError, { once: true });
      video.src = asset.url;
      video.load();

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        handleReady();
      }
    });
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
}

export async function preloadAudio(asset: MediaAsset): Promise<void> {
  if (asset.usage === "stream" && typeof Audio !== "undefined") {
    const audio = new Audio();
    audio.preload = "metadata";
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        window.clearTimeout(timeoutId);
        audio.removeEventListener("loadedmetadata", ready);
        audio.removeEventListener("error", failed);
      };
      const ready = () => { cleanup(); resolve(); };
      const failed = () => {
        cleanup();
        reject(new MediaPreloadError(`Audio metadata failed to load: ${asset.url}`, { retryable: true }));
      };
      const timeoutId = window.setTimeout(() => {
        cleanup();
        reject(new MediaPreloadError(`Audio metadata timed out: ${asset.url}`, { retryable: true }));
      }, DEFAULT_MEDIA_LOAD_TIMEOUT_MS);
      audio.addEventListener("loadedmetadata", ready, { once: true });
      audio.addEventListener("error", failed, { once: true });
      audio.src = asset.url;
      audio.load();
    }).finally(() => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    });
    return;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    DEFAULT_MEDIA_LOAD_TIMEOUT_MS,
  );

  try {
    const response = await fetch(asset.url, {
      cache: "force-cache",
      credentials: "same-origin",
      signal: controller.signal,
    });

    if (!response.ok) {
      const retryable =
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500;
      throw new MediaPreloadError(
        `Audio fetch failed with HTTP ${response.status}: ${asset.url}`,
        { retryable, statusCode: response.status },
      );
    }

    await response.blob();
  } catch (error) {
    if (error instanceof MediaPreloadError) throw error;
    const reason = controller.signal.aborted ? "timed out" : "failed";
    throw new MediaPreloadError(`Audio fetch ${reason}: ${asset.url}`, {
      retryable: true,
      cause: error,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export const DEFAULT_MEDIA_LOADERS: MediaLoaders = {
  image: preloadImage,
  video: preloadVideo,
  audio: preloadAudio,
};

export type SafePlayResult =
  | Readonly<{ played: true }>
  | Readonly<{ played: false; error: Error }>;

export async function safePlayVideo(
  video: Pick<HTMLVideoElement, "play">,
): Promise<SafePlayResult> {
  try {
    await video.play();
    return { played: true };
  } catch (error) {
    return {
      played: false,
      error: error instanceof Error ? error : new Error("Video playback rejected."),
    };
  }
}
