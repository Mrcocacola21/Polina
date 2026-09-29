"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";

import { useAudioEngine, useSceneAudio } from "@/lib/audio/AudioEngineContext";
import {
  collectionAllowsContinue,
  createSingleExecutionLock,
  S02_COLLECTION,
  S02_COPY,
  S02_NOTIFICATION_ASSETS,
  S02_NOTIFICATION_AUDIO,
  S02_TIMING,
} from "@/lib/cinematic/phase6";
import { COLLECTION_SCENE_SCALE, DUCK_PRESETS, FILM_MIX } from "@/lib/cinematic/directing";
import { useSceneRuntime } from "@/lib/cinematic/SceneRuntimeContext";
import { MediaImage } from "@/components/media/MediaImage";
import { useMediaAsset } from "@/lib/media/MediaPreloadContext";
import {
  useSceneSoulCollection,
  useSoulCollectionRuntime,
} from "@/lib/souls/SoulCollectionContext";
import type { ParticleFieldController } from "@/lib/visuals/VisualRuntime";
import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";
import { createSceneVisualScopeId } from "@/lib/visuals/VisualScope";

import styles from "./Soul02Scene.module.css";

export function Soul02Scene() {
  const rootRef = useRef<HTMLElement>(null);
  const ordinaryOneRef = useRef<HTMLElement>(null);
  const ordinaryTwoRef = useRef<HTMLElement>(null);
  const specialRef = useRef<HTMLButtonElement>(null);
  const phraseRef = useRef<HTMLParagraphElement>(null);
  const transitionTraceRef = useRef<HTMLSpanElement>(null);
  const firstLineRef = useRef<HTMLSpanElement>(null);
  const secondLineRef = useRef<HTMLSpanElement>(null);
  const finalWordRef = useRef<HTMLSpanElement>(null);
  const particlesRef = useRef<ParticleFieldController | null>(null);
  const lockRef = useRef(createSingleExecutionLock());
  const collectionStartedRef = useRef(false);
  const [specialReady, setSpecialReady] = useState(false);
  const [opened, setOpened] = useState(false);
  const [collectionStatus, setCollectionStatus] = useState("pending");
  const { phase, runId, completeEnter, completeExit, setCanAdvance, setContinueVisible } =
    useSceneRuntime();
  const ordinaryOne = useMediaAsset(S02_NOTIFICATION_ASSETS.ordinaryOne);
  const ordinaryTwo = useMediaAsset(S02_NOTIFICATION_ASSETS.ordinaryTwo);
  const notificationPolina = useMediaAsset(S02_NOTIFICATION_ASSETS.special);
  const audio = useAudioEngine();
  const sceneAudio = useSceneAudio();
  const { collect } = useSceneSoulCollection();
  const collectionRuntime = useSoulCollectionRuntime();
  const visual = useVisualRuntime();
  const scopeId = createSceneVisualScopeId("S02", runId);

  useEffect(() => {
    collectionRuntime.showHud();
    visual.setCursorMode("DEFAULT");
    visual.fadeFog(0, 0.8);
    visual.setGrain(0.018);
    visual.setVignette(0.58, 0.74);
    visual.setLightLeak(0);
    const particles = visual.spawnParticleField({
      mode: "AMBIENT_DRIFT",
      count: 38,
      spread: [8, 5, 2],
      size: [0.014, 0.045],
      opacity: 0.12,
      velocity: 0.016,
      drift: 0.045,
      color: "#8e2035",
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
    const timeline = gsap.timeline();
    timeline.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.72, ease: "power1.out" });
    timeline.eventCallback("onComplete", completeEnter);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [completeEnter, phase, scopeId, visual]);

  useEffect(() => {
    if (phase !== "active") return;
    const playCue = (ref: string, gain: number) => {
      if (!audio.getSnapshot().isUnlocked) return;
      void sceneAudio.playSfx(ref, { gain });
    };
    const appear = (element: Element | null, at: number) => {
      if (!element) return;
      timeline.fromTo(element, {
        opacity: 0,
        y: 14,
        filter: "blur(8px)",
      }, {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 0.72,
        ease: "power2.out",
      }, at);
    };
    const disappear = (element: Element | null, at: number) => {
      if (!element) return;
      timeline.to(element, {
        opacity: 0,
        y: -8,
        filter: "blur(5px)",
        duration: 0.62,
        ease: "power2.in",
      }, at);
    };
    const timeline = gsap.timeline();
    timeline.call(() => playCue(S02_NOTIFICATION_AUDIO.ordinary, FILM_MIX.sfx.s02Ordinary), [], S02_TIMING.ordinaryOne);
    appear(ordinaryOneRef.current, S02_TIMING.ordinaryOne);
    disappear(ordinaryOneRef.current, S02_TIMING.ordinaryOneOut);
    timeline.call(() => playCue(S02_NOTIFICATION_AUDIO.ordinary, FILM_MIX.sfx.s02Ordinary * 0.94), [], S02_TIMING.ordinaryTwo);
    appear(ordinaryTwoRef.current, S02_TIMING.ordinaryTwo);
    disappear(ordinaryTwoRef.current, S02_TIMING.ordinaryTwoOut);
    timeline.call(() => {
      playCue(S02_NOTIFICATION_AUDIO.special, FILM_MIX.sfx.s02Warm);
      setSpecialReady(true);
    }, [], S02_TIMING.special);
    appear(specialRef.current, S02_TIMING.special);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [audio, phase, sceneAudio, scopeId, visual]);

  function enterSpecial() {
    if (!specialReady || opened) return;
    visual.setCursorMode("INTERACTIVE");
    particlesRef.current?.attract([0.9, 0.25, 0]);
  }

  function leaveSpecial() {
    if (opened) return;
    visual.setCursorMode("DEFAULT");
    particlesRef.current?.update({ mode: "AMBIENT_DRIFT" });
  }

  function activateSpecial() {
    if (!specialReady || !lockRef.current()) return;
    setOpened(true);
    setSpecialReady(false);
    visual.setCursorMode("DEFAULT");
    particlesRef.current?.attract([0.35, 0, 0]);
    if (audio.getSnapshot().isUnlocked) {
      void sceneAudio.playSfx(S02_NOTIFICATION_AUDIO.open, {
        gain: FILM_MIX.sfx.s02Open,
        duckMusic: DUCK_PRESETS.intimateNotification,
      });
      void sceneAudio.playSfx(S02_NOTIFICATION_AUDIO.personalOpen, {
        gain: FILM_MIX.sfx.s02PolinaOpen,
      });
    }

    const timeline = gsap.timeline();
    timeline.to(specialRef.current, {
      scale: 1.018,
      filter: "brightness(1.06) drop-shadow(0 24px 42px rgb(0 0 0 / 52%)) drop-shadow(0 0 22px rgb(126 19 39 / 16%))",
      duration: 0.62,
      ease: "power2.out",
    });
    timeline.to(specialRef.current, {
      opacity: 0.2,
      filter: "brightness(0.72) blur(1.5px)",
      scale: 1.008,
      duration: 0.9,
      ease: "power2.inOut",
    }, 0.72);
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
    }, S02_TIMING.firstLineAfterOpen);
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
    }, S02_TIMING.secondLineAfterOpen);
    timeline.to(finalWordRef.current, {
      color: "rgb(250 224 229 / 100%)",
      textShadow: "0 0 18px rgb(224 45 77 / 48%)",
      duration: 0.75,
      yoyo: true,
      repeat: 1,
      ease: "sine.inOut",
    }, S02_TIMING.secondLineAfterOpen + 1.05);
    timeline.call(() => void runCollection(), [], S02_TIMING.collectionAfterOpen);
    visual.addScopeCleanup(scopeId, () => timeline.kill());
  }

  async function runCollection() {
    if (collectionStartedRef.current) return;
    collectionStartedRef.current = true;
    const existing = collectionRuntime
      .getSnapshot()
      .slots.find((slot) => slot.soulId === S02_COLLECTION.soulId);
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
      variant: S02_COLLECTION.variant,
      visualState: S02_COLLECTION.visualState,
      timingScale: COLLECTION_SCENE_SCALE.S02,
    });
    setCollectionStatus(result.status);
    if (collectionAllowsContinue(result.status)) scheduleContinue();
    else if (process.env.NODE_ENV === "development") {
      console.warn("S02 remains gated because SOUL_02 did not commit.", result);
    }
  }

  function scheduleContinue() {
    const timer = window.setTimeout(() => {
      setCanAdvance(true);
      setContinueVisible(true);
    }, S02_TIMING.continueDelay * 1000);
    visual.addScopeCleanup(scopeId, () => window.clearTimeout(timer));
  }

  useEffect(() => {
    if (phase !== "exiting") return;
    visual.setCursorMode("DEFAULT");
    particlesRef.current?.attract([0, 0, -1.5]);
    visual.fadeFog(0.025, 1.1);
    const timeline = gsap.timeline({ onComplete: completeExit });
    timeline.to(rootRef.current, {
      filter: "brightness(0.34)",
      duration: 0.75,
      ease: "power2.inOut",
    });
    timeline.fromTo(transitionTraceRef.current, {
      opacity: 0,
      scale: 0.45,
      filter: "blur(0px)",
    }, {
      opacity: 1,
      scale: 1,
      duration: 0.38,
      ease: "power2.out",
    }, 0.3);
    timeline.to(transitionTraceRef.current, {
      y: -18,
      scale: 0.035,
      opacity: 0.18,
      filter: "blur(3px)",
      duration: 1.05,
      ease: "power3.in",
    }, 0.62);
    timeline.to(rootRef.current, {
      scale: 1.035,
      opacity: 0.22,
      duration: 1.05,
      ease: "power2.in",
    }, 0.62);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [completeExit, phase, scopeId, visual]);

  return (
    <section
      ref={rootRef}
      className={styles.scene}
      data-testid="s02-scene"
      data-scene-phase={phase}
      data-special-ready={specialReady}
      data-special-opened={opened}
      data-collection-status={collectionStatus}
      aria-label="Notification"
    >
      <div className={styles.notificationSpace}>
        <article ref={ordinaryOneRef} className={`${styles.notification} ${styles.ordinary} ${styles.ordinaryOne}`} aria-hidden="true" data-notification-asset="not1">
          {ordinaryOne ? (
            <MediaImage asset={ordinaryOne} alt="" className={`${styles.notificationArtwork} ${styles.ordinaryArtwork}`} objectFit="contain" sizes="(max-width: 720px) calc(100vw - 28px), 34vw" eager />
          ) : (
            <span className={`${styles.notificationArtwork} ${styles.ordinaryArtwork}`} />
          )}
        </article>
        <article ref={ordinaryTwoRef} className={`${styles.notification} ${styles.ordinary} ${styles.ordinaryTwo}`} aria-hidden="true" data-notification-asset="not2">
          {ordinaryTwo ? (
            <MediaImage asset={ordinaryTwo} alt="" className={`${styles.notificationArtwork} ${styles.ordinaryArtwork}`} objectFit="contain" sizes="(max-width: 720px) calc(100vw - 28px), 34vw" eager />
          ) : (
            <span className={`${styles.notificationArtwork} ${styles.ordinaryArtwork}`} />
          )}
        </article>
        <button
          ref={specialRef}
          className={`${styles.notification} ${styles.special}`}
          type="button"
          disabled={!specialReady || opened}
          onClick={activateSpecial}
          onPointerEnter={enterSpecial}
          onPointerLeave={leaveSpecial}
          onFocus={enterSpecial}
          onBlur={leaveSpecial}
          data-testid="special-notification"
          data-notification-asset="notPolina"
          aria-label="Открыть уведомление"
        >
          {notificationPolina ? (
            <MediaImage asset={notificationPolina} alt="" className={`${styles.notificationArtwork} ${styles.specialArtwork}`} objectFit="contain" sizes="(max-width: 720px) calc(100vw - 24px), 46vw" eager />
          ) : (
            <span className={`${styles.notificationArtwork} ${styles.specialArtwork}`} aria-hidden="true" />
          )}
          <span className={styles.interactionHint} aria-hidden="true">
            <i />
            нажми, чтобы открыть
          </span>
        </button>
      </div>
      <p ref={phraseRef} className={styles.phrase} aria-label={S02_COPY.full}>
        <span ref={firstLineRef}>{S02_COPY.first}</span>
        <span ref={secondLineRef}>
          {S02_COPY.secondLead}<em ref={finalWordRef}>{S02_COPY.finalWord}</em>
        </span>
      </p>
      <span ref={transitionTraceRef} className={styles.transitionTrace} aria-hidden="true" />
    </section>
  );
}
