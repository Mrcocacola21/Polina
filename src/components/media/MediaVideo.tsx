"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { safePlayVideo, type SafePlayResult } from "@/lib/media/preloaders";
import type { MediaAsset } from "@/lib/media/types";

import styles from "./MediaPresentation.module.css";

type MediaVideoProps = Readonly<{
  asset: MediaAsset;
  className?: string;
  poster?: MediaAsset;
  muted?: boolean;
  playsInline?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  resetOnUnmount?: boolean;
  preload?: "none" | "metadata" | "auto";
  developmentLabel?: boolean;
  onPlaybackResult?: (result: SafePlayResult) => void;
}>;

export const MediaVideo = forwardRef<HTMLVideoElement, MediaVideoProps>(
  function MediaVideo(
    {
      asset,
      className,
      poster,
      muted = true,
      playsInline = true,
      autoPlay = false,
      loop = false,
      resetOnUnmount = true,
      preload = "auto",
      developmentLabel = false,
      onPlaybackResult,
    },
    forwardedRef,
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [renderStatus, setRenderStatus] = useState<
      "loading" | "ready" | "error"
    >(asset.kind === "video" ? "loading" : "error");
    const failed = renderStatus === "error" || asset.kind !== "video";
    const classes = [styles.frame, className].filter(Boolean).join(" ");

    useImperativeHandle(forwardedRef, () => {
      if (!videoRef.current) {
        throw new Error("MediaVideo ref is unavailable before mount.");
      }
      return videoRef.current;
    });

    useEffect(() => {
      const video = videoRef.current;
      return () => {
        if (!video) return;
        video.pause();
        if (resetOnUnmount) {
          try {
            video.currentTime = 0;
          } catch {
            // Metadata may not have loaded; pausing the owned element is sufficient.
          }
        }
        video.removeAttribute("src");
        video.load();
      };
    }, [resetOnUnmount]);

    async function handleCanPlay() {
      setRenderStatus("ready");
      if (autoPlay && videoRef.current) {
        onPlaybackResult?.(await safePlayVideo(videoRef.current));
      }
    }

    return (
      <div className={classes} data-media-status={renderStatus}>
        {!failed ? (
          <video
            ref={videoRef}
            className={renderStatus === "ready" ? styles.visible : styles.hidden}
            src={asset.url}
            poster={poster?.kind === "image" ? poster.url : undefined}
            muted={muted}
            playsInline={playsInline}
            autoPlay={autoPlay}
            controls={false}
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
            draggable={false}
            preload={preload}
            loop={loop}
            onCanPlay={() => void handleCanPlay()}
            onError={() => setRenderStatus("error")}
          />
        ) : null}
        {renderStatus !== "ready" ? (
          <div className={styles.fallback} aria-hidden="true">
            {developmentLabel && process.env.NODE_ENV === "development" ? (
              <span>{asset.id}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  },
);
