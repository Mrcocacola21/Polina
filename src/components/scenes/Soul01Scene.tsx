"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";

import { MediaImage } from "@/components/media/MediaImage";
import { useCapabilities } from "@/lib/accessibility/CapabilityContext";
import { useAudioEngine, useSceneAudio } from "@/lib/audio/AudioEngineContext";
import type { AmbientHandle } from "@/lib/audio/types";
import {
  collectionAllowsContinue,
  S01_COLLECTION,
  S01_COPY,
  S01_TIMING,
  PHASE6_MUSIC_STATE,
} from "@/lib/cinematic/phase6";
import { COLLECTION_SCENE_SCALE, FILM_MIX } from "@/lib/cinematic/directing";
import { useSceneRuntime } from "@/lib/cinematic/SceneRuntimeContext";
import { useMediaAsset } from "@/lib/media/MediaPreloadContext";
import {
  useSceneSoulCollection,
  useSoulCollectionRuntime,
} from "@/lib/souls/SoulCollectionContext";
import type { ParticleFieldController } from "@/lib/visuals/VisualRuntime";
import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";
import { createSceneVisualScopeId } from "@/lib/visuals/VisualScope";

import styles from "./Soul01Scene.module.css";

export function Soul01Scene() {
  const rootRef = useRef<HTMLElement>(null);
  const roomMotionRef = useRef<HTMLDivElement>(null);
  const roomPushRef = useRef<HTMLDivElement>(null);
  const screenshotRef = useRef<HTMLDivElement>(null);
  const phraseRef = useRef<HTMLParagraphElement>(null);
  const firstLineRef = useRef<HTMLSpanElement>(null);
  const secondLineRef = useRef<HTMLSpanElement>(null);
  const ambienceRef = useRef<AmbientHandle | null>(null);
  const particlesRef = useRef<ParticleFieldController | null>(null);
  const collectionStartedRef = useRef(false);
  const [collectionStatus, setCollectionStatus] = useState("pending");
  const { phase, runId, completeEnter, completeExit, setCanAdvance, setContinueVisible } =
    useSceneRuntime();
  const room = useMediaAsset("visual:sections.section01Asset01");
  const discord = useMediaAsset("visual:screens.discord");
  const audio = useAudioEngine();
  const sceneAudio = useSceneAudio();
  const { collect } = useSceneSoulCollection();
  const collectionRuntime = useSoulCollectionRuntime();
  const visual = useVisualRuntime();
  const capabilities = useCapabilities();
  const scopeId = createSceneVisualScopeId("S01", runId);

  useEffect(() => {
    collectionRuntime.showHud();
    visual.setCursorMode("DEFAULT");
    visual.setFog("NEUTRAL", 0.075, 1.4);
    visual.setGrain(0.028);
    visual.setVignette(0.34, 0.74);
    visual.setLightLeak(0.038, { position: [74, 46], scale: 1.18, rotation: -5, drift: true });
    const particles = visual.spawnParticleField({
      mode: "AMBIENT_DRIFT",
      count: 58,
      spread: [9, 5.5, 2.5],
      size: [0.016, 0.05],
      opacity: 0.16,
      velocity: 0.022,
      drift: 0.07,
      color: "#a72a3e",
      scopeId,
    });
    particlesRef.current = particles;
    return () => {
      particlesRef.current = null;
      particles.dispose();
    };
  }, [collectionRuntime, scopeId, visual]);

  useEffect(() => {
    const element = roomMotionRef.current;
    if (!element) return;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let frame = 0;
    const update = () => {
      if (finePointer.matches && capabilities.motionMode === "FULL" && capabilities.visibility === "visible") {
        const { x, y } = visual.pointer.smoothed;
        element.style.transform = `translate3d(${(x * 6).toFixed(2)}px, ${(-y * 4).toFixed(2)}px, 0)`;
      } else {
        element.style.transform = "translate3d(0, 0, 0)";
      }
      frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [capabilities.motionMode, capabilities.visibility, visual]);

  useEffect(() => {
    if (phase !== "entering") return;
    const reveal = visual.reveal("SOUL_CIRCLE", 1.05);
    const timeline = gsap.timeline();
    timeline.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 1.05, ease: "power1.out" });
    void Promise.all([reveal, new Promise<void>((resolve) => timeline.eventCallback("onComplete", resolve))])
      .then(() => completeEnter());
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [completeEnter, phase, scopeId, visual]);

  useEffect(() => {
    if (phase !== "active") return;

    if (audio.getSnapshot().isUnlocked) {
      void audio.setMusicState(PHASE6_MUSIC_STATE, { gain: FILM_MIX.music.s01, gainRampSeconds: 0.8 });
      void sceneAudio.playAmbient("LATE_NIGHT_ROOM", {
        gain: FILM_MIX.ambient.s01Room,
        fadeInSeconds: 2,
        loop: true,
      }).then((handle) => {
        ambienceRef.current = handle;
      });
    }

    const timeline = gsap.timeline();
    timeline.to(roomPushRef.current, {
      scale: 1.035,
      duration: S01_TIMING.cameraPush,
      ease: "none",
    }, 0);
    timeline.fromTo(screenshotRef.current, {
      opacity: 0,
      filter: "blur(17px)",
      scale: 0.96,
      y: 8,
    }, {
      opacity: 1,
      filter: "blur(0px)",
      scale: 1,
      y: 0,
      duration: 1.55,
      ease: "power2.out",
    }, S01_TIMING.screenshot);
    timeline.fromTo(firstLineRef.current, {
      opacity: 0,
      filter: "blur(8px)",
      y: 10,
    }, {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      duration: 1.05,
      ease: "power2.out",
    }, S01_TIMING.firstLine);
    timeline.fromTo(secondLineRef.current, {
      opacity: 0,
      filter: "blur(8px)",
      y: 10,
    }, {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      duration: 1.1,
      ease: "power2.out",
    }, S01_TIMING.secondLine);
    timeline.to(secondLineRef.current, {
      textShadow: "0 0 18px rgb(245 237 239 / 10%)",
      duration: 1.15,
      ease: "sine.out",
    }, S01_TIMING.settle);
    timeline.call(() => {
      particlesRef.current?.update({ velocity: 0.009, drift: 0.028, opacity: 0.1 });
      visual.setFogOpacity(0.055, 1.8);
      visual.setLightLeak(0.022, { drift: false });
    }, [], S01_TIMING.settle);
    // GSAP invokes this after render; the function declaration is stable for this keyed run.
    // eslint-disable-next-line react-hooks/immutability
    timeline.call(() => void runCollection(), [], S01_TIMING.collection);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
    // The active timeline intentionally owns the single collection attempt for this run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function runCollection() {
    if (collectionStartedRef.current) return;
    collectionStartedRef.current = true;
    const existing = collectionRuntime
      .getSnapshot()
      .slots.find((slot) => slot.soulId === S01_COLLECTION.soulId);
    if (existing?.status === "COLLECTED" || existing?.status === "RELEASED") {
      setCollectionStatus("already-collected");
      scheduleContinue();
      return;
    }
    const source = phraseRef.current;
    if (!source) return;
    setCollectionStatus("collecting");
    const result = await collect({
      source: { type: "TEXT", element: source },
      variant: S01_COLLECTION.variant,
      visualState: S01_COLLECTION.visualState,
      timingScale: COLLECTION_SCENE_SCALE.S01,
    });
    setCollectionStatus(result.status);
    if (collectionAllowsContinue(result.status)) scheduleContinue();
    else if (process.env.NODE_ENV === "development") {
      console.warn("S01 remains gated because SOUL_01 did not commit.", result);
    }
  }

  function scheduleContinue() {
    const timer = window.setTimeout(() => {
      setCanAdvance(true);
      setContinueVisible(true);
    }, S01_TIMING.continueDelay * 1000);
    visual.addScopeCleanup(scopeId, () => window.clearTimeout(timer));
  }

  useEffect(() => {
    if (phase !== "exiting") return;
    ambienceRef.current?.stop({ fadeSeconds: 0.72 });
    ambienceRef.current = null;
    visual.setCursorMode("DEFAULT");
    visual.fadeFog(0.015, 0.85);
    visual.setLightLeak(0, { drift: false });
    const timeline = gsap.timeline({ onComplete: completeExit });
    timeline.to(screenshotRef.current, {
      opacity: 0.08,
      filter: "saturate(0.4) brightness(0.42) blur(2px)",
      scale: 0.88,
      duration: 0.72,
      ease: "power2.inOut",
    }, 0);
    timeline.to(roomPushRef.current, {
      scale: 1.045,
      filter: "brightness(.32) saturate(.45)",
      duration: 0.9,
      ease: "sine.inOut",
    }, 0);
    timeline.to(rootRef.current, {
      opacity: 0.12,
      duration: 0.48,
      ease: "power2.in",
    }, 0.42);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [completeExit, phase, scopeId, visual]);

  return (
    <section
      ref={rootRef}
      className={styles.scene}
      data-testid="s01-scene"
      data-scene-phase={phase}
      data-collection-status={collectionStatus}
      aria-label="Discord / Calm"
    >
      <div ref={roomMotionRef} className={styles.roomMotion} aria-hidden="true">
        <div ref={roomPushRef} className={styles.roomPush}>
          {room ? <MediaImage asset={room} alt="" className={styles.room} objectFit="cover" /> : null}
        </div>
      </div>
      <div className={styles.shadow} aria-hidden="true" />
      <div ref={screenshotRef} className={styles.discordMemory}>
        {discord ? (
          <MediaImage
            asset={discord}
            alt="Discord memory"
            className={styles.discordImage}
            objectFit="contain"
            sizes="(max-width: 720px) 88vw, 58vw"
          />
        ) : null}
      </div>
      <p ref={phraseRef} className={styles.phrase} aria-label={S01_COPY.full}>
        <span ref={firstLineRef}>{S01_COPY.first}</span>
        <span ref={secondLineRef}>{S01_COPY.second}</span>
      </p>
    </section>
  );
}
