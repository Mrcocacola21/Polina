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

import styles from "./Soul07Scene.module.css";

function centerOf(element: HTMLElement | null): readonly [number, number] | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0
    ? [rect.left + rect.width / 2, rect.top + rect.height / 2]
    : null;
}

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
  const prosRef = useRef<HTMLDivElement>(null);
  const displacementRef = useRef<HTMLDivElement>(null);
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
  const pros = useMediaAsset("visual:screens.prosOfDatingMe");
  const displacement = useMediaAsset("visual:global.asset06");
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
    timeline.fromTo(prosRef.current, { opacity: 0, x: 28, rotate: 2 }, { opacity: 0.88, x: 0, rotate: -1, duration: 0.25, ease: "power2.out" }, S07_TIMING.infinity + 0.12);
    timeline.to(prosRef.current, { opacity: 0, x: 18, duration: 0.28, ease: "power2.in" }, S07_TIMING.infinity + 1.08);
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
    const timeline = gsap.timeline({ onComplete: completeExit });
    timeline.to(orbitOneRef.current, { rotation: "+=31", scale: 0.94, duration: 0.52, ease: "power2.in" }, 0.12);
    timeline.to(orbitTwoRef.current, { rotation: "-=47", scale: 1.06, duration: 0.52, ease: "power2.in" }, 0.12);
    timeline.to(ratingValueRef.current, { scaleX: 1.14, skewX: -7, x: 4, duration: 0.12, ease: "power2.in" }, 0.22);
    timeline.to(ratingValueRef.current, { scaleX: 0.96, skewX: 2, x: -2, duration: 0.13, ease: "power2.out" }, 0.34);
    timeline.fromTo(displacementRef.current, { opacity: 0, xPercent: -1.2 }, { opacity: 0.38, xPercent: 1.2, duration: 0.1, ease: "none" }, 0.29);
    timeline.to(displacementRef.current, { opacity: 0, xPercent: 0, duration: 0.13, ease: "power2.in" }, 0.39);
    timeline.fromTo(crimsonFlashRef.current, { opacity: 0 }, { opacity: 0.44, duration: 0.09, ease: "power2.out" }, 0.43);
    timeline.to(crimsonFlashRef.current, { opacity: 0.08, duration: 0.32, ease: "power2.in" }, 0.52);
    timeline.to(rootRef.current, { filter: "contrast(1.2) brightness(.28) saturate(.7)", opacity: 0.08, duration: 0.68, ease: "power2.inOut" }, 0.38);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [completeExit, phase, scopeId, visual]);

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
      <div ref={prosRef} className={styles.prosCard} aria-hidden="true">{pros ? <MediaImage asset={pros} alt="" objectFit="contain" eager /> : null}</div>
      <div ref={displacementRef} className={styles.displacementPulse} aria-hidden="true">{displacement ? <MediaImage asset={displacement} alt="" eager /> : null}</div>
      <div ref={crimsonFlashRef} className={styles.crimsonFlash} aria-hidden="true" />
    </section>
  );
}
