"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";

import type { MediaAsset } from "@/lib/media/types";

import styles from "./MediaPresentation.module.css";

type MediaImageProps = Readonly<{
  asset: MediaAsset;
  alt: string;
  className?: string;
  sizes?: string;
  objectFit?: CSSProperties["objectFit"];
  developmentLabel?: boolean;
}>;

export function MediaImage({
  asset,
  alt,
  className,
  sizes = "100vw",
  objectFit = "cover",
  developmentLabel = false,
}: MediaImageProps) {
  const [renderStatus, setRenderStatus] = useState<"loading" | "ready" | "error">(
    asset.kind === "image" ? "loading" : "error",
  );
  const failed = renderStatus === "error" || asset.kind !== "image";
  const classes = [styles.frame, className].filter(Boolean).join(" ");

  return (
    <div className={classes} data-media-status={renderStatus}>
      {!failed ? (
        <Image
          className={renderStatus === "ready" ? styles.visible : styles.hidden}
          src={asset.url}
          alt={alt}
          fill
          sizes={sizes}
          unoptimized
          decoding="async"
          onLoad={() => setRenderStatus("ready")}
          onError={() => setRenderStatus("error")}
          style={{ objectFit }}
        />
      ) : null}
      {renderStatus !== "ready" ? (
        <div className={styles.fallback} aria-hidden={alt.length === 0}>
          {developmentLabel && process.env.NODE_ENV === "development" ? (
            <span>{asset.id}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
