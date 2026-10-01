"use client";

import gsap from "gsap";
import { useCallback, useEffect, useRef, useState } from "react";

import { MediaImage } from "@/components/media/MediaImage";
import { MediaVideo } from "@/components/media/MediaVideo";
import { useAudioEngine, useSceneAudio } from "@/lib/audio/AudioEngineContext";
import type { ProceduralHandle } from "@/lib/audio/types";
import {
  formatRating,
  PHASE8_MUSIC_STATE,
  phase8CollectionAllowsContinue,
  S07_COLLECTION,
  S07_COPY,
  S07_RATING_STEPS,
  S07_TIMING,
} from "@/lib/cinematic/phase8";
import { COLLECTION_SCENE_SCALE, FILM_MIX } from "@/lib/cinematic/directing";
import { useSceneRuntime } from "@/lib/cinematic/SceneRuntimeContext";
import { useMediaAsset } from "@/lib/media/MediaPreloadContext";
import { useSceneSoulCollection, useSoulCollectionRuntime } from "@/lib/souls/SoulCollectionContext";
import type { ParticleFieldController } from "@/lib/visuals/VisualRuntime";
import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";
import { createSceneVisualScopeId } from "@/lib/visuals/VisualScope";
import {
  CinematicFractureController,
  type CinematicFracturePreset,
} from "@/lib/visuals/cinematic-fracture";

import styles from "./Soul07Scene.module.css";

function centerOf(element: HTMLElement | null): readonly [number, number] | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0
    ? [rect.left + rect.width / 2, rect.top + rect.height / 2]
    : null;
}

const S07_FRACTURES = Object.freeze({
  first: Object.freeze({
    intensity: 0.24, sliceAmount: 3, sliceCount: 2, chromaticOffset: 1,
    verticalShear: 0, lumaTear: 0.04, frameEcho: 0, scanlineWarp: 0.08,
    edgeEnergy: 0.08, duration: 68, seed: 7071, blackTears: 0, radialStretch: 0,
    protectedBand: [0.24, 0.72] as const,
  }),
  second: Object.freeze({
    intensity: 0.52, sliceAmount: 8, sliceCount: 4, chromaticOffset: 1.8,
    verticalShear: 1.2, lumaTear: 0.09, frameEcho: 0.09, scanlineWarp: 0.14,
    edgeEnergy: 0.16, duration: 118, seed: 7072, blackTears: 0, radialStretch: 0,
    protectedBand: [0.24, 0.72] as const,
  }),
  final: Object.freeze({
    intensity: 0.9, sliceAmount: 14, sliceCount: 6, chromaticOffset: 3,
    verticalShear: 2.5, lumaTear: 0.16, frameEcho: 0.12, scanlineWarp: 0.22,
    edgeEnergy: 0.32, duration: 260, seed: 7073, blackTears: 1, radialStretch: 0.012,
    protectedBand: [0.24, 0.72] as const, revealAmount: 0.62,
  }),
} satisfies Readonly<Record<string, CinematicFracturePreset>>);

export function Soul07Scene() {
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const stillRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const orbitOneRef = useRef<SVGSVGElement>(null);
  const orbitTwoRef = useRef<SVGSVGElement>(null);
  const sincereRef = useRef<HTMLSpanElement>(null);
  const ratingCopyRef = useRef<HTMLSpanElement>(null);
  const ratingPanelRef = useRef<HTMLDivElement>(null);
  const ratingValueRef = useRef<HTMLOutputElement>(null);
  const ratingLineRef = useRef<HTMLSpanElement>(null);
  const heroRef = useRef<HTMLSpanElement>(null);
  const asideRef = useRef<HTMLSpanElement>(null);
  const fractureHostRef = useRef<HTMLDivElement>(null);
  const fractureControllerRef = useRef<CinematicFractureController | null>(null);
  const crimsonFlashRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<ParticleFieldController | null>(null);
  const ratingAudioRef = useRef<ProceduralHandle | null>(null);
  const collectionStartedRef = useRef(false);
  const timelineStartedRef = useRef(false);
  const [videoPlayed, setVideoPlayed] = useState(false);
  const [ratingResolved, setRatingResolved] = useState(false);
  const [collectionStatus, setCollectionStatus] = useState("pending");
  const { phase, runId, completeEnter, completeExit, setCanAdvance, setContinueVisible } = useSceneRuntime();
  const stage = useMediaAsset("visual:sections.section07Asset01");
  const petals = useMediaAsset("visual:sections.section07Asset05");
  const warmth = useMediaAsset("visual:global.asset07");
  const polina = useMediaAsset("visual:screens.polina");
  const polinaCircle = useMediaAsset("visual:screens.polinaCircle");
  const throneHall = useMediaAsset("visual:sections.section08Asset02");
  const audio = useAudioEngine();
  const sceneAudio = useSceneAudio();
  const { collect } = useSceneSoulCollection();
  const collectionRuntime = useSoulCollectionRuntime();
  const visual = useVisualRuntime();
  const scopeId = createSceneVisualScopeId("S07", runId);

  useEffect(() => {
    collectionRuntime.showHud();
    visual.setCursorMode("DEFAULT");
    visual.setFog("CRIMSON", 0.04, 1.4);
    visual.setGrain(0.018);
    visual.setVignette(0.56, 0.8);
    visual.setLightLeak(0.018, { position: [50, 46], scale: 1.1, rotation: 7, drift: true });
    const particles = visual.spawnParticleField({
      mode: "ORBIT",
      count: 38,
      position: [0, 0.1, 0],
      spread: [4.2, 3.2, 1.5],
      size: [0.012, 0.045],
      opacity: 0.16,
      velocity: 0.055,
      drift: 0.03,
      color: "#a91d32",
      scopeId,
    });
    particlesRef.current = particles;
    return () => {
      ratingAudioRef.current?.stop({ fadeSeconds: 0.08 });
      ratingAudioRef.current = null;
      particlesRef.current = null;
      particles.dispose();
      fractureControllerRef.current?.dispose();
      fractureControllerRef.current = null;
    };
  }, [collectionRuntime, scopeId, visual]);

  useEffect(() => {
    if (phase !== "entering") return;
    const timeline = gsap.timeline({ onComplete: completeEnter });
    timeline.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.7, ease: "sine.out" });
    timeline.fromTo(stageRef.current, { opacity: 0, filter: "blur(9px)", scale: 1.025 }, { opacity: 1, filter: "blur(0px)", scale: 1, duration: S07_TIMING.stageReveal, ease: "power2.out" }, 0);
    timeline.fromTo(haloRef.current, { opacity: 0, scale: 0.5 }, { opacity: 0.62, scale: 1, duration: 1.1, ease: "power2.out" }, 0.15);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [completeEnter, phase, scopeId, visual]);

  const runCollection = useCallback(async () => {
    if (collectionStartedRef.current) return;
    collectionStartedRef.current = true;
    const point = centerOf(haloRef.current);
    if (!point) return;
    setCollectionStatus("collecting");
    const result = await collect({
      source: { type: "POINT", point },
      variant: S07_COLLECTION.variant,
      visualState: S07_COLLECTION.visualState,
      timingScale: COLLECTION_SCENE_SCALE.S07,
    });
    setCollectionStatus(result.status);
    if (phase8CollectionAllowsContinue(result.status)) {
      const timer = window.setTimeout(() => {
        setCanAdvance(true);
        setContinueVisible(true);
      }, S07_TIMING.continueDelay * 1000);
      visual.addScopeCleanup(scopeId, () => window.clearTimeout(timer));
    }
  }, [collect, scopeId, setCanAdvance, setContinueVisible, visual]);

  useEffect(() => {
    if (phase !== "active" || timelineStartedRef.current) return;
    timelineStartedRef.current = true;
    const transitionLabReady = process.env.NODE_ENV === "development" &&
      new URLSearchParams(window.location.search).get("transitionLab") === "1";
    if (transitionLabReady) {
      const readyTimer = window.setTimeout(() => setRatingResolved(true), 0);
      if (ratingValueRef.current) ratingValueRef.current.textContent = formatRating(0, true);
      ratingLineRef.current?.style.setProperty("--rating-fill", "100%");
      rootRef.current?.setAttribute("data-transition-lab-state", "RATING_INFINITY_READY");
      gsap.set(stageRef.current, { opacity: 1, filter: "blur(0px)", scale: 1 });
      gsap.set([stillRef.current, videoRef.current], { opacity: 1, filter: "blur(0px)", scale: 1 });
      gsap.set([ratingPanelRef.current, heroRef.current], { opacity: 1 });
      gsap.set([orbitOneRef.current, orbitTwoRef.current], { opacity: 0.72, scale: 1 });
      return () => window.clearTimeout(readyTimer);
    }
    if (audio.getSnapshot().isUnlocked) {
      void audio.setMusicState(PHASE8_MUSIC_STATE, { gain: FILM_MIX.music.s07, gainRampSeconds: 1.2 });
      void sceneAudio.playSfx("audio:scenes.s07.cue01", { gain: FILM_MIX.sfx.s07Arrival });
    }

    const rating = { value: 0 };
    const updateRating = () => {
      if (ratingValueRef.current) ratingValueRef.current.textContent = formatRating(rating.value);
      if (ratingLineRef.current) ratingLineRef.current.style.setProperty("--rating-fill", `${Math.min(100, rating.value)}%`);
    };
    const timeline = gsap.timeline();
    timeline.fromTo(stillRef.current, { opacity: 0, filter: "blur(10px)", scale: 0.96 }, { opacity: 1, filter: "blur(0px)", scale: 1, duration: 1.2, ease: "power2.out" }, S07_TIMING.stillReveal);
    timeline.to(stillRef.current, { opacity: 0.28, filter: "blur(3px)", scale: 1.025, duration: 1.2, ease: "sine.inOut" }, S07_TIMING.videoReveal);
    timeline.fromTo(videoRef.current, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 1.35, ease: "power2.out" }, S07_TIMING.videoReveal);
    timeline.fromTo(sincereRef.current, { opacity: 0, filter: "blur(8px)", y: 10 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 1.25, ease: "power2.out" }, S07_TIMING.sincere);
    timeline.call(() => {
      if (audio.getSnapshot().isUnlocked) {
        ratingAudioRef.current = sceneAudio.startRatingRise({ startFrequency: 145, endFrequency: 980, durationSeconds: S07_TIMING.ratingDuration, gain: FILM_MIX.sfx.s07RatingRise });
      }
    }, [], S07_TIMING.ratingStart);
    timeline.fromTo(ratingPanelRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.75, ease: "power2.out" }, S07_TIMING.ratingStart);
    timeline.fromTo(ratingCopyRef.current, { opacity: 0, filter: "blur(7px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.95 }, S07_TIMING.ratingStart + 0.35);
    const segment = S07_TIMING.ratingDuration / (S07_RATING_STEPS.length - 1);
    S07_RATING_STEPS.slice(1).forEach((value, index) => {
      timeline.to(rating, { value, duration: segment, ease: index < 3 ? "power1.inOut" : "power2.in", onUpdate: updateRating }, S07_TIMING.ratingStart + index * segment);
    });
    timeline.call(() => {
      ratingAudioRef.current?.stop({ fadeSeconds: 0.06 });
      ratingAudioRef.current = null;
      setRatingResolved(true);
      if (ratingValueRef.current) ratingValueRef.current.textContent = formatRating(0, true);
      if (audio.getSnapshot().isUnlocked) void sceneAudio.playSfx("audio:scenes.s07.cue02", { gain: FILM_MIX.sfx.s07Resolve });
      particlesRef.current?.burst();
    }, [], S07_TIMING.infinity);
    timeline.to([orbitOneRef.current, orbitTwoRef.current], { rotation: "+=24", duration: 0.7, ease: "power2.inOut" }, S07_TIMING.infinity);
    timeline.fromTo(heroRef.current, { opacity: 0, filter: "blur(7px)", scale: 0.92 }, { opacity: 1, filter: "blur(0px)", scale: 1, duration: 0.75, ease: "power3.out" }, S07_TIMING.hero);
    timeline.call(() => {
      if (audio.getSnapshot().isUnlocked) void sceneAudio.playSfx("audio:scenes.s07.cue03", { gain: FILM_MIX.sfx.s07Pop });
    }, [], S07_TIMING.aside);
    timeline.fromTo(asideRef.current, { opacity: 0, filter: "blur(5px)", y: 5 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 0.8, ease: "sine.out" }, S07_TIMING.aside);
    timeline.to([ratingPanelRef.current, heroRef.current], { opacity: 0.18, duration: 0.9, ease: "sine.inOut" }, S07_TIMING.collection - 0.7);
    timeline.to([orbitOneRef.current, orbitTwoRef.current], { opacity: 0.18, scale: 0.92, duration: 0.9 }, S07_TIMING.collection - 0.7);
    timeline.to(haloRef.current, { opacity: 0.94, scale: 0.24, duration: 0.95, ease: "power2.in" }, S07_TIMING.collection - 0.7);
    timeline.call(() => void runCollection(), [], S07_TIMING.collection);
    visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [audio, phase, runCollection, sceneAudio, scopeId, visual]);

  useEffect(() => {
    if (phase !== "exiting") return;
    ratingAudioRef.current?.stop({ fadeSeconds: 0.05 });
    ratingAudioRef.current = null;
    particlesRef.current?.dissolve();
    visual.setLightLeak(0, { drift: false });
    visual.fadeFog(0.01, 0.7);
    const fracture = (preset: CinematicFracturePreset, revealHall = false) => {
      if (!rootRef.current || !fractureHostRef.current) return;
      fractureControllerRef.current ??= new CinematicFractureController(rootRef.current, fractureHostRef.current);
      fractureControllerRef.current.fracture(
        { ...preset, revealImageUrl: revealHall ? throneHall?.url : undefined },
        {
          quality: visual.quality,
          motionMode: visual.motionMode,
          mobile: window.matchMedia("(max-width: 760px)").matches,
        },
      );
    };
    const reduced = visual.motionMode === "REDUCED";
    const timeline = gsap.timeline({ onComplete: completeExit });
    timeline.to([orbitOneRef.current, orbitTwoRef.current], { rotation: 0, duration: 0.22, ease: "power2.out" }, 0);
    if (!reduced) {
      timeline.call(() => fracture(S07_FRACTURES.first), [], 0.28);
      timeline.to(ratingValueRef.current, { scaleX: 1.055, x: 2, duration: 0.068, ease: "steps(2)" }, 0.28);
      timeline.to(ratingValueRef.current, { scaleX: 1, x: 0, duration: 0.08, ease: "power2.out" }, 0.348);
      timeline.call(() => fracture(S07_FRACTURES.second), [], 0.64);
      timeline.to(ratingValueRef.current, { scaleX: 1.14, skewX: -4, x: 5, duration: 0.118, ease: "steps(3)" }, 0.64);
      timeline.to(ratingValueRef.current, { scaleX: 1, skewX: 0, x: 0, duration: 0.1, ease: "power2.out" }, 0.758);
      timeline.to(orbitOneRef.current, { rotation: "+=18", scaleX: 1.035, duration: 0.118, ease: "steps(3)" }, 0.64);
      timeline.to(orbitTwoRef.current, { rotation: "-=25", scaleY: 0.975, duration: 0.118, ease: "steps(3)" }, 0.64);
      timeline.to([orbitOneRef.current, orbitTwoRef.current], { scaleX: 1, scaleY: 1, duration: 0.12 }, 0.758);
      timeline.call(() => fracture(S07_FRACTURES.final, true), [], 1.1);
    } else {
      timeline.call(() => fracture(S07_FRACTURES.final, true), [], 0.62);
    }
    timeline.fromTo(crimsonFlashRef.current, { opacity: 0 }, { opacity: 0.25, duration: 0.18, ease: "power2.out" }, reduced ? 0.62 : 1.1);
    timeline.to(crimsonFlashRef.current, { opacity: 0.06, duration: 0.34, ease: "power2.in" });
    timeline.to([stageRef.current, orbitOneRef.current, orbitTwoRef.current], {
      scaleX: 0.972,
      filter: "brightness(.34) saturate(.58) contrast(1.16)",
      duration: 0.46,
      ease: "power3.in",
    }, reduced ? 0.72 : 1.18);
    timeline.to(rootRef.current, { filter: "contrast(1.16) brightness(.24) saturate(.62)", opacity: 0.04, duration: 0.52, ease: "power2.inOut" }, reduced ? 0.84 : 1.38);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [completeExit, phase, scopeId, throneHall?.url, visual]);

  return (
    <section ref={rootRef} className={styles.scene} data-testid="s07-scene" data-scene-phase={phase} data-video-played={videoPlayed} data-rating-resolved={ratingResolved} data-collection-status={collectionStatus} aria-label="Admiration">
      <div ref={stageRef} className={styles.stage} aria-hidden="true">{stage ? <MediaImage asset={stage} alt="" eager /> : null}</div>
      <div className={styles.warmth} aria-hidden="true">{warmth ? <MediaImage asset={warmth} alt="" eager /> : null}</div>
      <div className={styles.petals} aria-hidden="true">{petals ? <MediaImage asset={petals} alt="" eager /> : null}</div>
      <div className={styles.portraitStage}>
        <div ref={haloRef} className={styles.halo} aria-hidden="true" />
        <svg ref={orbitOneRef} className={`${styles.orbit} ${styles.orbitOne}`} viewBox="0 0 200 200" aria-hidden="true"><ellipse cx="100" cy="100" rx="88" ry="72" /><circle cx="188" cy="100" r="2" /></svg>
        <svg ref={orbitTwoRef} className={`${styles.orbit} ${styles.orbitTwo}`} viewBox="0 0 200 200" aria-hidden="true"><ellipse cx="100" cy="100" rx="76" ry="91" /><circle cx="100" cy="9" r="1.8" /></svg>
        <div ref={stillRef} className={styles.still}>{polina ? <MediaImage asset={polina} alt="Polina" objectFit="contain" eager /> : null}</div>
        <div ref={videoRef} className={`${styles.video} ${videoPlayed ? styles.videoPlayed : styles.videoFallback}`}>
          {polinaCircle ? <MediaVideo asset={polinaCircle} poster={polina ?? undefined} muted playsInline autoPlay loop onPlaybackResult={(result) => setVideoPlayed(result.played)} /> : null}
        </div>
      </div>
      <p className={styles.copy} aria-label={S07_COPY.full}>
        <span ref={sincereRef} className={styles.sincere}>{S07_COPY.sincere}</span>
        <span ref={ratingCopyRef} className={styles.ratingCopy}>{S07_COPY.rating}</span>
        <span ref={heroRef} className={styles.hero}>{S07_COPY.hero}</span>
        <span ref={asideRef} className={styles.aside}>{S07_COPY.aside}</span>
      </p>
      <div ref={ratingPanelRef} className={`${styles.ratingPanel} ${ratingResolved ? styles.ratingResolved : ""}`} aria-label="Admiration rating">
        <span className={styles.ratingLabel}>admiration</span>
        <output ref={ratingValueRef} className={styles.ratingValue} aria-hidden="true">0%</output>
        <span className={styles.srOnly}>{ratingResolved ? "Admiration beyond a finite percentage." : "Admiration is being expressed."}</span>
        <span ref={ratingLineRef} className={styles.ratingLine} aria-hidden="true" />
      </div>
      <div ref={fractureHostRef} className={styles.fractureHost} data-cinematic-fracture-host="true" aria-hidden="true" />
      <div ref={crimsonFlashRef} className={styles.crimsonFlash} aria-hidden="true" />
    </section>
  );
}
