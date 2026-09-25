"use client";

import { useEffect, useRef, type CSSProperties } from "react";

import { VISUAL_ASSETS } from "@/lib/visuals/assets";
import {
  useVisualFx,
  useVisualRuntime,
} from "@/lib/visuals/VisualRuntimeContext";

import styles from "./visuals.module.css";

type FxStyle = CSSProperties & Record<`--${string}`, string | number>;

function FogLayer() {
  const runtime = useVisualRuntime();
  const fx = useVisualFx();
  const videoRef = useRef<HTMLVideoElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    runtime.registerFogElement(layerRef.current ?? undefined);
    return () => runtime.registerFogElement(undefined);
  }, [fx.fog, runtime]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (fx.fog && fx.fogOpacity > 0) {
      void video.play().catch(() => {
        if (process.env.NODE_ENV === "development") {
          console.warn("Fog video autoplay was blocked; the layer remains safely hidden until playable.");
        }
      });
    } else {
      video.pause();
    }
    return () => {
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
        // The owned element is already paused; metadata may not exist yet.
      }
      video.removeAttribute("src");
      video.load();
    };
  }, [fx.fog, fx.fogOpacity, runtime]);

  if (!fx.fog) return null;
  return (
    <div
      ref={layerRef}
      className={styles.fogLayer}
      style={{ opacity: fx.fogOpacity, transitionDuration: `${fx.fogDuration}s` }}
      data-fog-variant={fx.fog}
    >
      <video
        key={fx.fog}
        ref={videoRef}
        src={VISUAL_ASSETS.fog[fx.fog]}
        muted
        playsInline
        autoPlay
        loop
        preload="auto"
      />
    </div>
  );
}

function GrainLayer() {
  const fx = useVisualFx();
  return (
    <div
      className={styles.grainLayer}
      style={{ opacity: fx.grain }}
      aria-hidden="true"
    />
  );
}

function VignetteLayer() {
  const fx = useVisualFx();
  const edge = Math.round(22 + fx.vignetteSoftness * 36);
  const style: FxStyle = {
    "--vignette-strength": fx.vignette,
    "--vignette-edge": `${edge}%`,
    "--vignette-x": `${fx.vignetteCenter[0]}%`,
    "--vignette-y": `${fx.vignetteCenter[1]}%`,
  };
  return <div className={styles.vignetteLayer} style={style} aria-hidden="true" />;
}

function LightLeakLayer() {
  const fx = useVisualFx();
  if (fx.lightLeak <= 0) return null;
  const style: FxStyle = {
    opacity: fx.lightLeak,
    backgroundImage: `url(${VISUAL_ASSETS.lightLeak})`,
    "--leak-scale": fx.lightLeakScale,
    "--leak-x": `${fx.lightLeakPosition[0]}%`,
    "--leak-y": `${fx.lightLeakPosition[1]}%`,
    "--leak-rotation": `${fx.lightLeakRotation}deg`,
  };
  return (
    <div
      className={`${styles.lightLeakLayer} ${fx.lightLeakDrift && fx.lightLeak > 0 ? styles.lightLeakDrift : ""}`}
      style={style}
      aria-hidden="true"
    >
    </div>
  );
}

function TransitionLayer() {
  const runtime = useVisualRuntime();
  const fx = useVisualFx();
  const elementRef = useRef<HTMLDivElement>(null);
  const masked = fx.transitionType !== "FADE";
  const maskUrl = masked ? VISUAL_ASSETS.transitions[fx.transitionType] : undefined;
  const style: CSSProperties = maskUrl
    ? {
        maskImage: `url(${maskUrl})`,
        WebkitMaskImage: `url(${maskUrl})`,
      }
    : {};

  useEffect(() => {
    runtime.registerTransitionElement(elementRef.current ?? undefined);
    return () => runtime.registerTransitionElement(undefined);
  }, [runtime]);

  return (
    <div
      ref={elementRef}
      className={`${styles.transitionLayer} ${masked ? styles.maskedTransition : ""}`}
      style={style}
      data-testid="transition-mask"
      data-transition-type={fx.transitionType}
      data-transition-state={fx.transitionState}
      aria-hidden="true"
    />
  );
}

function AbsoluteBlackLayer() {
  const runtime = useVisualRuntime();
  const fx = useVisualFx();
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    runtime.registerAbsoluteBlackElement(elementRef.current ?? undefined);
    return () => runtime.registerAbsoluteBlackElement(undefined);
  }, [runtime]);

  return (
    <div
      ref={elementRef}
      className={styles.absoluteBlackLayer}
      data-absolute-black={fx.absoluteBlack ? "true" : "false"}
      aria-hidden="true"
    />
  );
}

export function GlobalFxLayers() {
  const fx = useVisualFx();
  return (
    <>
      {!fx.absoluteBlack ? <FogLayer /> : null}
      {!fx.absoluteBlack ? <GrainLayer /> : null}
      {!fx.absoluteBlack ? <VignetteLayer /> : null}
      {!fx.absoluteBlack ? <LightLeakLayer /> : null}
      <TransitionLayer />
      <AbsoluteBlackLayer />
    </>
  );
}
