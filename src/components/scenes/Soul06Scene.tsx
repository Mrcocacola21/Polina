"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";

import { MediaImage } from "@/components/media/MediaImage";
import { useAudioEngine, useSceneAudio } from "@/lib/audio/AudioEngineContext";
import {
  createPhase8ActivationLock,
  normalizedPointInRect,
  PHASE8_MUSIC_STATE,
  phase8CollectionAllowsContinue,
  S06_COLLECTION,
  S06_COPY,
  S06_HEART_HOTSPOT,
  S06_TIMING,
} from "@/lib/cinematic/phase8";
import { COLLECTION_SCENE_SCALE, FILM_MIX } from "@/lib/cinematic/directing";
import { useSceneRuntime } from "@/lib/cinematic/SceneRuntimeContext";
import { useMediaAsset } from "@/lib/media/MediaPreloadContext";
import { useSceneSoulCollection, useSoulCollectionRuntime } from "@/lib/souls/SoulCollectionContext";
import type { ParticleFieldController } from "@/lib/visuals/VisualRuntime";
import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";
import { createSceneVisualScopeId } from "@/lib/visuals/VisualScope";

import styles from "./Soul06Scene.module.css";

export function Soul06Scene() {
  const rootRef = useRef<HTMLElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const hotspotRef = useRef<HTMLButtonElement>(null);
  const shockwaveRef = useRef<HTMLSpanElement>(null);
  const energyRef = useRef<HTMLSpanElement>(null);
  const firstRef = useRef<HTMLSpanElement>(null);
  const secondRef = useRef<HTMLSpanElement>(null);
  const thirdRef = useRef<HTMLSpanElement>(null);
  const soulWordRef = useRef<HTMLElement>(null);
  const particlesRef = useRef<ParticleFieldController | null>(null);
  const activationLockRef = useRef(createPhase8ActivationLock());
  const collectionStartedRef = useRef(false);
  const [activated, setActivated] = useState(false);
  const [collectionStatus, setCollectionStatus] = useState("pending");
  const { phase, runId, completeEnter, completeExit, setCanAdvance, setContinueVisible } = useSceneRuntime();
  const heartReaction = useMediaAsset("visual:screens.heartReaction");
  const audio = useAudioEngine();
  const sceneAudio = useSceneAudio();
  const { collect } = useSceneSoulCollection();
  const collectionRuntime = useSoulCollectionRuntime();
  const visual = useVisualRuntime();
  const scopeId = createSceneVisualScopeId("S06", runId);

  useEffect(() => {
    collectionRuntime.showHud();
    visual.setCursorMode("DEFAULT");
    visual.setFog("CRIMSON", 0.028, 1.2);
    visual.setGrain(0.018);
    visual.setVignette(0.65, 0.8);
    visual.setLightLeak(0.012, { position: [48, 46], scale: 0.82, drift: false });
    const particles = visual.spawnParticleField({
      mode: "AMBIENT_DRIFT",
      count: 22,
      position: [-1.55, 0.32, 0],
      spread: [5.4, 3.4, 1.8],
      size: [0.012, 0.038],
      opacity: 0.11,
      velocity: 0.012,
      drift: 0.028,
      color: "#a91d32",
      scopeId,
    });
    particlesRef.current = particles;
    return () => {
      particlesRef.current = null;
      particles.dispose();
    };
  }, [collectionRuntime, scopeId, visual]);

  useEffect(() => {
    if (phase !== "entering") return;
    if (audio.getSnapshot().isUnlocked) {
      void audio.setMusicState(PHASE8_MUSIC_STATE, { gain: FILM_MIX.music.s06, gainRampSeconds: 1.2 });
    }
    const timeline = gsap.timeline({ onComplete: completeEnter });
    timeline.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "sine.out" });
    timeline.fromTo(mediaRef.current, { opacity: 0, filter: "blur(12px)", scale: 0.97 }, {
      opacity: 1,
      filter: "blur(0px)",
      scale: 1,
      duration: S06_TIMING.reveal,
      ease: "power2.out",
    }, 0.12);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [audio, completeEnter, phase, scopeId, visual]);

  function hotspotPoint(): readonly [number, number] | null {
    const element = mediaRef.current;
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return normalizedPointInRect(rect, S06_HEART_HOTSPOT);
  }

  function enterHeart() {
    if (activated) return;
    visual.setCursorMode("INTERACTIVE");
    const point = hotspotPoint();
    const world = point ? visual.screenToWorld(point[0], point[1]) : undefined;
    if (world) particlesRef.current?.attract(world);
  }

  function leaveHeart() {
    if (activated) return;
    visual.setCursorMode("DEFAULT");
    particlesRef.current?.update({ mode: "AMBIENT_DRIFT", opacity: 0.11, velocity: 0.012 });
  }

  function activateHeart() {
    if (!activationLockRef.current()) return;
    setActivated(true);
    visual.setCursorMode("DEFAULT");
    if (audio.getSnapshot().isUnlocked) {
      void sceneAudio.playSfx("audio:scenes.s06.cue01", { gain: FILM_MIX.sfx.s06Heart });
    }
    const point = hotspotPoint();
    const world = point ? visual.screenToWorld(point[0], point[1]) : undefined;
    if (world) {
      visual.spawnParticleField({
        mode: "BURST",
        count: 26,
        position: world,
        spread: [0.42, 0.35, 0.35],
        size: [0.018, 0.052],
        opacity: 0.72,
        velocity: 0.32,
        drift: 0.08,
        lifetime: 2.4,
        fade: 0.5,
        color: "#e05a69",
        scopeId,
      });
      particlesRef.current?.attract(world);
      particlesRef.current?.update({ opacity: 0.22, velocity: 0.025 });
    }
    visual.setLightLeak(0.022, { position: [45, 48], scale: 0.92, drift: true });

    const timeline = gsap.timeline();
    timeline.fromTo(shockwaveRef.current, { opacity: 0.72, scale: 0.18 }, {
      opacity: 0,
      scale: 3.1,
      duration: 1.05,
      ease: "power2.out",
    }, 0);
    timeline.fromTo(energyRef.current, { opacity: 0.35, scale: 0.65 }, {
      opacity: 1,
      scale: 1.35,
      duration: 0.55,
      yoyo: true,
      repeat: 1,
      ease: "sine.inOut",
    }, 0);
    for (const [element, at] of [
      [firstRef.current, S06_TIMING.first],
      [secondRef.current, S06_TIMING.second],
      [thirdRef.current, S06_TIMING.third],
    ] as const) {
      timeline.fromTo(element, { opacity: 0, filter: "blur(8px)", y: 10 }, {
        opacity: 1,
        filter: "blur(0px)",
        y: 0,
        duration: 1.05,
        ease: "power2.out",
      }, at);
    }
    timeline.to(soulWordRef.current, {
      color: "#fff4ef",
      textShadow: "0 0 18px rgb(222 36 64 / 55%)",
      duration: 0.8,
      yoyo: true,
      repeat: 1,
    }, S06_TIMING.soulBeat);
    timeline.to(energyRef.current, { opacity: 1, scale: 1.7, duration: 0.72, ease: "sine.inOut" }, S06_TIMING.soulBeat);
    timeline.to([firstRef.current, secondRef.current, thirdRef.current], { opacity: 0.24, duration: 0.85 }, S06_TIMING.collection - 0.3);
    timeline.call(() => void runCollection(), [], S06_TIMING.collection);
    visual.addScopeCleanup(scopeId, () => timeline.kill());
  }

  async function runCollection() {
    if (collectionStartedRef.current) return;
    collectionStartedRef.current = true;
    const point = hotspotPoint();
    if (!point) return;
    setCollectionStatus("collecting");
    const result = await collect({
      source: { type: "POINT", point },
      variant: S06_COLLECTION.variant,
      visualState: S06_COLLECTION.visualState,
      timingScale: COLLECTION_SCENE_SCALE.S06,
    });
    setCollectionStatus(result.status);
    if (phase8CollectionAllowsContinue(result.status)) scheduleContinue();
  }

  function scheduleContinue() {
    const timer = window.setTimeout(() => {
      setCanAdvance(true);
      setContinueVisible(true);
    }, S06_TIMING.continueDelay * 1000);
    visual.addScopeCleanup(scopeId, () => window.clearTimeout(timer));
  }

  useEffect(() => {
    if (phase !== "exiting") return;
    visual.setCursorMode("DEFAULT");
    particlesRef.current?.attract([0, 0, 0]);
    const timeline = gsap.timeline({ onComplete: completeExit });
    timeline.to(mediaRef.current, { opacity: 0.18, scale: 0.86, filter: "blur(5px)", duration: 0.9, ease: "power2.inOut" });
    const point = hotspotPoint();
    timeline.to(energyRef.current, {
      x: point ? window.innerWidth / 2 - point[0] : 0,
      y: point ? window.innerHeight / 2 - point[1] : 0,
      scale: 7,
      opacity: 0.46,
      duration: 1.05,
      ease: "power2.inOut",
    }, 0);
    timeline.to(rootRef.current, { opacity: 0, duration: 0.55 }, 0.72);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [completeExit, phase, scopeId, visual]);

  return (
    <section ref={rootRef} className={styles.scene} data-testid="s06-scene" data-scene-phase={phase} data-activated={activated} data-collection-status={collectionStatus} aria-label="Heart Reaction">
      <div className={styles.atmosphere} aria-hidden="true" />
      <div ref={mediaRef} className={styles.reactionMedia} data-testid="heart-reaction-media">
        {heartReaction ? <MediaImage asset={heartReaction} alt="Heart reaction in a personal message" objectFit="contain" eager /> : null}
        <span ref={shockwaveRef} className={styles.shockwave} aria-hidden="true" />
        <span ref={energyRef} className={styles.energyPoint} aria-hidden="true" />
        <button
          ref={hotspotRef}
          className={styles.heartHotspot}
          type="button"
          disabled={activated}
          onClick={activateHeart}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            activateHeart();
          }}
          onPointerEnter={enterHeart}
          onPointerLeave={leaveHeart}
          onFocus={enterHeart}
          onBlur={leaveHeart}
          data-testid="heart-reaction-hotspot"
          aria-label="Activate the heart reaction"
        />
      </div>
      <p className={styles.phrase} aria-label={S06_COPY.full}>
        <span ref={firstRef}>{S06_COPY.first}</span>
        <span ref={secondRef}>{S06_COPY.second}</span>
        <span ref={thirdRef}>{S06_COPY.thirdLead}<em ref={soulWordRef}>{S06_COPY.soulWord}</em>{S06_COPY.thirdTail}</span>
      </p>
    </section>
  );
}
