"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";

import { MediaImage } from "@/components/media/MediaImage";
import { useSceneRuntime } from "@/lib/cinematic/SceneRuntimeContext";
import {
  useMediaAsset,
  usePreloadGroup,
} from "@/lib/media/MediaPreloadContext";
import { useSoulCollectionRuntime } from "@/lib/souls/SoulCollectionContext";
import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";
import { createSceneVisualScopeId } from "@/lib/visuals/VisualScope";

import styles from "./PreloaderScene.module.css";

const PRELOADER_TIMING = Object.freeze({
  enter: 1.05,
  completionBeat: 0.72,
  exit: 0.72,
});

export function PreloaderScene() {
  const rootRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const completionStarted = useRef(false);
  const { phase, runId, completeEnter, completeExit, setCanAdvance, requestAdvance } =
    useSceneRuntime();
  const progress = usePreloadGroup("BOOT_CRITICAL");
  const brand = useMediaAsset("visual:brand.asset02");
  const visual = useVisualRuntime();
  const souls = useSoulCollectionRuntime();
  const scopeId = createSceneVisualScopeId("PRELOADER", runId);
  const settled = progress.state === "ready" || progress.state === "ready-with-errors";
  const circumference = 2 * Math.PI * 46;
  const dashOffset = circumference * (1 - progress.percentage / 100);

  useEffect(() => {
    souls.hideHud();
    visual.setCursorMode("HIDDEN");
    visual.setFog("NEUTRAL", 0.035, 0.8);
    visual.setGrain(0.022);
    visual.setVignette(0.5, 0.72);
    const particles = visual.spawnParticleField({
      mode: "AMBIENT_DRIFT",
      count: 42,
      spread: [8, 5, 2],
      size: [0.018, 0.055],
      opacity: 0.18,
      velocity: 0.025,
      drift: 0.08,
      color: "#9e2439",
      scopeId,
    });
    return () => particles.dispose();
  }, [scopeId, souls, visual]);

  useEffect(() => {
    if (phase !== "entering" || !rootRef.current || !contentRef.current) return;
    const timeline = gsap.timeline({ onComplete: completeEnter });
    timeline.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5 });
    timeline.fromTo(
      contentRef.current,
      { opacity: 0, filter: "blur(10px)", y: 8 },
      { opacity: 1, filter: "blur(0px)", y: 0, duration: PRELOADER_TIMING.enter, ease: "power2.out" },
      0.12,
    );
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [completeEnter, phase, scopeId, visual]);

  useEffect(() => {
    if (phase !== "active" || !settled || completionStarted.current) return;
    completionStarted.current = true;
    setCanAdvance(true);
    const timeline = gsap.timeline({
      onComplete: requestAdvance,
    });
    timeline.to(contentRef.current, {
      scale: 1.015,
      filter: "brightness(1.16)",
      duration: 0.32,
      ease: "power1.out",
    });
    timeline.to(contentRef.current, {
      scale: 1,
      filter: "brightness(1)",
      duration: 0.3,
      ease: "power1.inOut",
    });
    timeline.to({}, { duration: PRELOADER_TIMING.completionBeat - 0.62 });
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [phase, requestAdvance, scopeId, setCanAdvance, settled, visual]);

  useEffect(() => {
    if (phase !== "exiting") return;
    visual.fadeFog(0.012, PRELOADER_TIMING.exit);
    const timeline = gsap.timeline({ onComplete: completeExit });
    timeline.to(contentRef.current, {
      opacity: 0,
      filter: "blur(8px)",
      scale: 0.985,
      duration: PRELOADER_TIMING.exit,
      ease: "power2.in",
    });
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [completeExit, phase, scopeId, visual]);

  return (
    <section
      ref={rootRef}
      className={styles.scene}
      data-testid="preloader-scene"
      data-scene-phase={phase}
      aria-label="SOULBOUND loading"
    >
      <div ref={contentRef} className={styles.content}>
        <div className={styles.sigilWrap} aria-hidden="true">
          {brand ? <MediaImage asset={brand} alt="" className={styles.sigil} objectFit="contain" /> : null}
          <svg className={styles.progressRing} viewBox="0 0 104 104">
            <circle className={styles.progressTrack} cx="52" cy="52" r="46" />
            <circle
              className={styles.progressValue}
              cx="52"
              cy="52"
              r="46"
              style={{ strokeDasharray: circumference, strokeDashoffset: dashOffset }}
            />
          </svg>
        </div>
        <p className={styles.eyebrow}>REQUIEM OF FEELINGS</p>
        <h1>SOULBOUND</h1>
        <div className={styles.status} data-testid="boot-preload-progress" aria-live="polite">
          <span>{settled ? "prepared" : "binding fragments"}</span>
          <span>{Math.round(progress.percentage).toString().padStart(2, "0")}</span>
        </div>
        {process.env.NODE_ENV === "development" && progress.failed > 0 ? (
          <p className={styles.degraded}>{progress.failed} media fallback(s) active</p>
        ) : null}
      </div>
    </section>
  );
}
