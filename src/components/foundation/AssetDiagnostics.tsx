"use client";

import { useEffect, useState } from "react";

import { assetUrl } from "@/lib/assets/paths";
import { loadMediaManifests } from "@/lib/assets/manifests";

import styles from "./AssetDiagnostics.module.css";

type DiagnosticState = {
  visual: "loading" | "loaded" | "error";
  audio: "loading" | "loaded" | "error";
  assets: "checking" | "valid" | "error";
};

function collectAssetPaths(value: unknown, paths: string[] = []): string[] {
  if (typeof value === "string") {
    paths.push(value);
  } else if (value !== null && typeof value === "object") {
    Object.values(value).forEach((child) => collectAssetPaths(child, paths));
  }

  return paths;
}

export function AssetDiagnostics() {
  const [status, setStatus] = useState<DiagnosticState>({
    visual: "loading",
    audio: "loading",
    assets: "checking",
  });

  useEffect(() => {
    const controller = new AbortController();

    async function runDiagnostics() {
      try {
        const { visual: visualManifest, audio: audioManifest } =
          await loadMediaManifests();

        setStatus({ visual: "loaded", audio: "loaded", assets: "checking" });

        const paths = collectAssetPaths([visualManifest, audioManifest]);
        const responses = await Promise.all(
          paths.map((path) =>
            fetch(assetUrl(path), {
              method: "HEAD",
              cache: "no-store",
              signal: controller.signal,
            }),
          ),
        );

        setStatus({
          visual: "loaded",
          audio: "loaded",
          assets: responses.every((response) => response.ok) ? "valid" : "error",
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error("SOULBOUND asset diagnostics failed.", error);
        setStatus({ visual: "error", audio: "error", assets: "error" });
      }
    }

    void runDiagnostics();

    return () => controller.abort();
  }, []);

  return (
    <aside className={styles.panel} aria-live="polite">
      <strong>SOULBOUND</strong>
      <span>visual manifest: {status.visual}</span>
      <span>audio manifest: {status.audio}</span>
      <span>assets: {status.assets}</span>
    </aside>
  );
}
