"use client";

import gsap from "gsap";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { MediaImage } from "@/components/media/MediaImage";
import { MediaVideo } from "@/components/media/MediaVideo";
import { useAudioEngine, useSceneAudio } from "@/lib/audio/AudioEngineContext";
import type { AmbientHandle, SfxHandle } from "@/lib/audio/types";
import {
  isS09AlreadyCommitted,
  mapS09Fog,
  PainAbsorptionController,
  PHASE10_MUSIC_STATE,
  phase10CollectionAllowsContinue,
  S09_AUDIO,
  S09_COLLECTION,
  S09_COPY,
  S09_MIX,
  S09_TIMING,
  S09_VISUAL_LEVELS,
  type PainAbsorptionState,
} from "@/lib/cinematic/phase10";
import { useSceneRuntime } from "@/lib/cinematic/SceneRuntimeContext";
import { useMediaAsset } from "@/lib/media/MediaPreloadContext";
import { useSceneSoulCollection, useSoulCollectionRuntime } from "@/lib/souls/SoulCollectionContext";
import type { ParticleFieldController } from "@/lib/visuals/VisualRuntime";
import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";
import { createSceneVisualScopeId } from "@/lib/visuals/VisualScope";

import styles from "./Soul09Scene.module.css";

function centerOf(element: HTMLElement | null): readonly [number, number] | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0
    ? [rect.left + rect.width / 2, rect.top + rect.height / 2]
    : null;
}

export function Soul09Scene() {
  const rootRef = useRef<HTMLElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const environmentRef = useRef<HTMLDivElement>(null);
  const rainRef = useRef<HTMLVideoElement>(null);
  const painRef = useRef<HTMLDivElement>(null);
  const fracturedRef = useRef<HTMLDivElement>(null);
  const fragmentIdentityRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLSpanElement>(null);
  const secondRef = useRef<HTMLSpanElement>(null);
  const thirdRef = useRef<HTMLSpanElement>(null);
  const finalRef = useRef<HTMLSpanElement>(null);
  const holdRef = useRef<HTMLButtonElement>(null);
  const controllerRef = useRef(new PainAbsorptionController());
  const particlesRef = useRef<ParticleFieldController | null>(null);
  const droneRef = useRef<AmbientHandle | null>(null);
  const rainAudioRef = useRef<AmbientHandle | null>(null);
  const progressAudioRef = useRef<SfxHandle | null>(null);
  const progressAudioRequestedRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const rafRef = useRef(0);
  const lastAudioUpdateRef = useRef(0);
  const completedRef = useRef(false);
  const collectionStartedRef = useRef(false);
  const timelineStartedRef = useRef(false);
  const lastStateRef = useRef<PainAbsorptionState>("idle");
  const [interactionAvailable, setInteractionAvailable] = useState(false);
  const [interactionState, setInteractionState] = useState<PainAbsorptionState>("idle");
  const [finalVisible, setFinalVisible] = useState(false);
  const [sceneBeat, setSceneBeat] = useState("entry");
  const [collectionStatus, setCollectionStatus] = useState("pending");
  const { phase, runId, completeEnter, completeExit, setCanAdvance, setContinueVisible } = useSceneRuntime();
  const environment = useMediaAsset("visual:sections.section09Asset01");
  const rain = useMediaAsset("visual:sections.section09Asset02");
  const fracturedLight = useMediaAsset("visual:sections.section09Asset03");
  const fragmentIdentity = useMediaAsset("visual:sections.section09Asset04");
  const pain = useMediaAsset("visual:screens.pain");
  const audio = useAudioEngine();
  const sceneAudio = useSceneAudio();
  const { collect } = useSceneSoulCollection();
  const collectionRuntime = useSoulCollectionRuntime();
  const visual = useVisualRuntime();
  const scopeId = createSceneVisualScopeId("S09", runId);

  const setSemanticState = useCallback((state: PainAbsorptionState) => {
    if (lastStateRef.current === state) return;
    lastStateRef.current = state;
    setInteractionState(state);
  }, []);

  const applyProgress = useCallback((progress: number, now: number) => {
    rootRef.current?.style.setProperty("--absorb-progress", progress.toFixed(4));
    holdRef.current?.style.setProperty("--absorb-progress", progress.toFixed(4));

    const point = centerOf(holdRef.current);
    const world = point ? visual.screenToWorld(point[0], point[1], 0) : undefined;
    particlesRef.current?.updateContinuous({
      mode: progress > 0.008 ? "ATTRACT" : "AMBIENT_DRIFT",
      attraction: world,
      attractionStrength: 0.08 + progress * progress * 2.5,
      opacity: S09_VISUAL_LEVELS.particleRestingOpacity +
        (S09_VISUAL_LEVELS.particlePeakOpacity - S09_VISUAL_LEVELS.particleRestingOpacity) * progress,
      velocity: 0.008 + progress * 0.035,
      drift: 0.018 * (1 - progress),
    });
    visual.setFogOpacityContinuous(mapS09Fog(progress));

    if (fracturedRef.current) {
      const offset = (1 - progress) * 9;
      fracturedRef.current.style.transform = `translate3d(${offset}px, ${-offset * 0.42}px, 0) scale(${1.018 - progress * 0.012})`;
      fracturedRef.current.style.filter = `brightness(${0.46 + progress * 0.15}) saturate(${0.42 + progress * 0.12}) blur(${(1 - progress) * 0.7}px)`;
    }
    if (fragmentIdentityRef.current) {
      fragmentIdentityRef.current.style.opacity = String(0.12 + progress * 0.3);
      fragmentIdentityRef.current.style.transform = `translate3d(0, ${progress * -5}px, 0) scale(${1 - progress * 0.08})`;
    }
    if (painRef.current) {
      painRef.current.style.filter = `brightness(${0.55 + progress * 0.09}) saturate(${0.5 + progress * 0.08}) contrast(${1.06 - progress * 0.03})`;
    }

    if (now - lastAudioUpdateRef.current >= 45 || progress === 1) {
      lastAudioUpdateRef.current = now;
      progressAudioRef.current?.setGain(S09_MIX.absorptionPeak * Math.pow(progress, 1.35), 0.08);
      progressAudioRef.current?.setPlaybackRate(0.82 + progress * 0.18);
      droneRef.current?.setGain(S09_MIX.drone * (1 - progress * 0.2), 0.1);
      rainAudioRef.current?.setGain(S09_MIX.rain * (1 - progress * 0.25), 0.1);
    }
  }, [visual]);

  const scheduleContinue = useCallback(() => {
    const timer = window.setTimeout(() => {
      setCanAdvance(true);
      setContinueVisible(true);
      setSceneBeat("complete");
    }, S09_TIMING.continueDelay * 1000);
    visual.addScopeCleanup(scopeId, () => window.clearTimeout(timer));
  }, [scopeId, setCanAdvance, setContinueVisible, visual]);

  const runCollection = useCallback(async () => {
    if (collectionStartedRef.current) return;
    collectionStartedRef.current = true;
    collectionRuntime.showHud();
    const existing = collectionRuntime.getSnapshot().slots.find((slot) => slot.soulId === S09_COLLECTION.soulId);
    if (isS09AlreadyCommitted(existing?.status)) {
      setCollectionStatus("already-collected");
      scheduleContinue();
      return;
    }
    const point = centerOf(holdRef.current);
    if (!point) {
      setCollectionStatus("failed");
      return;
    }
    setSceneBeat("collection");
    setCollectionStatus("collecting");
    const result = await collect({
      source: { type: "POINT", point },
      variant: S09_COLLECTION.variant,
      visualState: S09_COLLECTION.visualState,
      voice: S09_COLLECTION.voice,
    });
    setCollectionStatus(result.status);
    if (phase10CollectionAllowsContinue(result.status)) scheduleContinue();
  }, [collect, collectionRuntime, scheduleContinue]);

  const completeAbsorption = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setSemanticState("completed");
    setInteractionAvailable(false);
    setFinalVisible(true);
    setSceneBeat("final-phrase");
    visual.setCursorMode("DIMMED");
    progressAudioRef.current?.stop({ fadeSeconds: 0.65 });
    progressAudioRef.current = null;
    particlesRef.current?.updateContinuous({ mode: "ATTRACT", attractionStrength: 3.2, opacity: 0.5 });
    if (audio.getSnapshot().isUnlocked) {
      void sceneAudio.playSfx(S09_AUDIO.completion, {
        gain: S09_MIX.completion,
        duckMusic: { to: 0.78, attackSeconds: 0.12, holdSeconds: 0.55, releaseSeconds: 1.5 },
      });
    }
    gsap.fromTo(finalRef.current, { opacity: 0, filter: "blur(5px)", y: 7 }, {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      duration: 1.45,
      ease: "sine.out",
    });
    const timer = window.setTimeout(() => void runCollection(), S09_TIMING.finalHold * 1000);
    visual.addScopeCleanup(scopeId, () => window.clearTimeout(timer));
  }, [audio, runCollection, sceneAudio, scopeId, setSemanticState, visual]);

  const ensureProgressAudio = useCallback(() => {
    if (progressAudioRequestedRef.current || !audio.getSnapshot().isUnlocked) return;
    progressAudioRequestedRef.current = true;
    void sceneAudio.playSfx(S09_AUDIO.absorption, {
      loop: true,
      gain: 0,
      playbackRate: 0.82,
    }).then((handle) => {
      if (!handle || controllerRef.current.snapshot().state === "cancelled") {
        handle?.stop();
        return;
      }
      progressAudioRef.current = handle;
      const progress = controllerRef.current.snapshot().progress;
      handle.setGain(S09_MIX.absorptionPeak * Math.pow(progress, 1.35), 0.08);
    });
  }, [audio, sceneAudio]);

  const startHold = useCallback(() => {
    if (!interactionAvailable || completedRef.current) return;
    ensureProgressAudio();
    setSemanticState(controllerRef.current.startHold(performance.now()).state);
    visual.setCursorMode("ABSORPTION");
  }, [ensureProgressAudio, interactionAvailable, setSemanticState, visual]);

  const endHold = useCallback(() => {
    if (completedRef.current) return;
    const snapshot = controllerRef.current.endHold(performance.now());
    setSemanticState(snapshot.state);
    if (snapshot.completed) {
      completeAbsorption();
      return;
    }
    visual.setCursorMode(interactionAvailable ? "ABSORPTION" : "DIMMED");
  }, [completeAbsorption, interactionAvailable, setSemanticState, visual]);

  useEffect(() => {
    const controller = new PainAbsorptionController();
    controllerRef.current = controller;
    collectionRuntime.showHud();
    visual.setCursorMode("DIMMED");
    visual.setFog("HEAVY", S09_VISUAL_LEVELS.fogResting, 1.8);
    visual.setGrain(0.04);
    visual.setVignette(0.78, 0.78);
    visual.setVignetteCenter(52, 48);
    visual.setLightLeak(0.014, { position: [58, 43], scale: 0.9, rotation: -4, drift: false });
    const particles = visual.spawnParticleField({
      mode: "AMBIENT_DRIFT",
      count: visual.motionIntensity < 0.5 ? 28 : visual.quality === "HIGH" ? 78 : visual.quality === "LOW" ? 34 : 54,
      position: [0.8, -0.05, 0],
      spread: [4.6, 3.4, 2.1],
      size: [0.014, 0.064],
      opacity: S09_VISUAL_LEVELS.particleRestingOpacity,
      velocity: 0.008,
      drift: 0.018,
      attractionStrength: 0.08,
      color: "#7f1d2b",
      depthRange: [-1.6, 1.4],
      scopeId,
    });
    particlesRef.current = particles;
    return () => {
      controller.cancel();
      if (controllerRef.current === controller) {
        controllerRef.current = new PainAbsorptionController();
      }
      window.cancelAnimationFrame(rafRef.current);
      progressAudioRef.current?.stop({ fadeSeconds: 0.08 });
      droneRef.current?.stop({ fadeSeconds: 0.18 });
      rainAudioRef.current?.stop({ fadeSeconds: 0.18 });
      progressAudioRef.current = null;
      droneRef.current = null;
      rainAudioRef.current = null;
      particlesRef.current = null;
      particles.dispose();
      visual.setCursorMode("DEFAULT");
      visual.fadeFog(0, 0.25);
      visual.setLightLeak(0, { drift: false });
      visual.setGrain(0.055);
      visual.setVignette(0.42, 0.62);
      visual.setVignetteCenter(50, 50);
    };
  }, [collectionRuntime, scopeId, visual]);

  useEffect(() => {
    if (phase !== "entering") return;
    if (audio.getSnapshot().isUnlocked) {
      void audio.crossfadeMusic(PHASE10_MUSIC_STATE, { crossfadeSeconds: S09_TIMING.musicCrossfade });
      void sceneAudio.playAmbient(S09_AUDIO.drone, {
        loop: true,
        gain: S09_MIX.drone,
        playbackRate: 0.96,
        fadeInSeconds: 2.4,
      }).then((handle) => { droneRef.current = handle; });
      void sceneAudio.playAmbient(S09_AUDIO.rain, {
        loop: true,
        gain: S09_MIX.rain,
        playbackRate: 0.98,
        fadeInSeconds: 3.2,
      }).then((handle) => { rainAudioRef.current = handle; });
    }
    const timeline = gsap.timeline({ onComplete: completeEnter });
    timeline.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: S09_TIMING.entryReveal, ease: "sine.out" });
    timeline.fromTo(environmentRef.current, {
      opacity: 0,
      filter: "brightness(.18) saturate(.12) blur(5px)",
      scale: 1.015,
    }, {
      opacity: 0.72,
      filter: "brightness(.42) saturate(.34) blur(0px)",
      scale: 1,
      duration: 2.1,
      ease: "sine.out",
    }, 0.1);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [audio, completeEnter, phase, sceneAudio, scopeId, visual]);

  useEffect(() => {
    if (phase !== "active" || timelineStartedRef.current) return;
    timelineStartedRef.current = true;
    const motionScale = visual.motionIntensity < 0.5 ? 1.008 : S09_VISUAL_LEVELS.cameraScale;
    const timeline = gsap.timeline();
    timeline.to(cameraRef.current, { scale: motionScale, duration: 25, ease: "sine.inOut" }, 0);
    timeline.call(() => {
      setSceneBeat("pain");
      if (audio.getSnapshot().isUnlocked) {
        void sceneAudio.playSfx(S09_AUDIO.fracturedLight, { gain: S09_MIX.fracturedLight, pan: 0.08 });
      }
    }, [], S09_TIMING.painReveal);
    timeline.fromTo(painRef.current, { opacity: 0, filter: "blur(18px) brightness(.42)", scale: 0.98 }, {
      opacity: 0.66,
      filter: "blur(0px) brightness(.55) saturate(.5) contrast(1.06)",
      scale: 1,
      duration: 2.2,
      ease: "sine.out",
    }, S09_TIMING.painReveal);
    timeline.fromTo([fracturedRef.current, fragmentIdentityRef.current], { opacity: 0 }, { opacity: 0.14, duration: 1.8, ease: "sine.out" }, S09_TIMING.painReveal + 0.45);
    timeline.call(() => setSceneBeat("first-line"), [], S09_TIMING.first);
    timeline.fromTo(firstRef.current, { opacity: 0, filter: "blur(7px)", y: 10 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 1.35, ease: "sine.out" }, S09_TIMING.first);
    timeline.call(() => setSceneBeat("second-line"), [], S09_TIMING.second);
    timeline.fromTo(secondRef.current, { opacity: 0, filter: "blur(7px)", y: 9 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 1.6, ease: "sine.out" }, S09_TIMING.second);
    timeline.call(() => setSceneBeat("third-line"), [], S09_TIMING.third);
    timeline.fromTo(thirdRef.current, { opacity: 0, filter: "blur(6px)", y: 8 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 1.35, ease: "sine.out" }, S09_TIMING.third);
    timeline.call(() => {
      setInteractionAvailable(true);
      setSceneBeat("waiting-for-hold");
    }, [], S09_TIMING.interaction);
    timeline.fromTo(holdRef.current, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 1.2, ease: "sine.out" }, S09_TIMING.interaction);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [audio, phase, sceneAudio, scopeId, visual]);

  useEffect(() => {
    if (phase !== "active" || !interactionAvailable) return;
    const frame = (now: number) => {
      const snapshot = controllerRef.current.tick(now);
      setSemanticState(snapshot.state);
      applyProgress(snapshot.progress, now);
      if (snapshot.completed) {
        completeAbsorption();
        return;
      }
      rafRef.current = window.requestAnimationFrame(frame);
    };
    rafRef.current = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(rafRef.current);
  }, [applyProgress, completeAbsorption, interactionAvailable, phase, setSemanticState]);

  useEffect(() => {
    if (!interactionAvailable || completedRef.current) return;
    const release = () => endHold();
    const onVisibility = () => { if (document.hidden) release(); };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.key === "Enter") release();
    };
    window.addEventListener("blur", release);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", release);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [endHold, interactionAvailable]);

  useEffect(() => {
    if (phase !== "exiting") return;
    controllerRef.current.endHold(performance.now());
    rainRef.current?.pause();
    progressAudioRef.current?.stop({ fadeSeconds: 0.25 });
    droneRef.current?.stop({ fadeSeconds: 0.8 });
    rainAudioRef.current?.stop({ fadeSeconds: 0.65 });
    progressAudioRef.current = null;
    particlesRef.current?.dissolve();
    visual.setCursorMode("DIMMED");
    visual.setFogOpacity(S09_VISUAL_LEVELS.fogResting * 0.82, 0.9);
    const timeline = gsap.timeline({ onComplete: completeExit });
    timeline.to([painRef.current, fracturedRef.current, fragmentIdentityRef.current], { opacity: 0, scale: 0.985, duration: 0.9, ease: "sine.in" }, 0);
    timeline.to(rootRef.current, { opacity: 0, filter: "brightness(.3)", duration: S09_TIMING.exit, ease: "sine.inOut" }, 0.15);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [completeExit, phase, scopeId, visual]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!interactionAvailable || completedRef.current) return;
    event.preventDefault();
    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    startHold();
  };

  const handlePointerRelease = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (pointerIdRef.current !== event.pointerId) return;
    pointerIdRef.current = null;
    endHold();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if ((event.code !== "Space" && event.key !== "Enter") || event.repeat) return;
    event.preventDefault();
    startHold();
  };

  return (
    <section
      ref={rootRef}
      className={styles.scene}
      data-testid="s09-scene"
      data-scene-phase={phase}
      data-scene-beat={sceneBeat}
      data-interaction-state={interactionState}
      data-collection-status={collectionStatus}
      data-music-state={PHASE10_MUSIC_STATE}
      aria-label="Pain and care"
    >
      <div ref={cameraRef} className={styles.camera}>
        <div ref={environmentRef} className={styles.environment} aria-hidden="true">
          {environment ? <MediaImage asset={environment} alt="" eager /> : null}
        </div>
        <div className={styles.rain} aria-hidden="true">
          {rain ? <MediaVideo ref={rainRef} asset={rain} muted playsInline autoPlay loop /> : null}
        </div>
        <div ref={fracturedRef} className={styles.fractured} aria-hidden="true">
          {fracturedLight ? <MediaImage asset={fracturedLight} alt="" eager /> : null}
        </div>
        <div ref={fragmentIdentityRef} className={styles.fragmentIdentity} aria-hidden="true">
          {fragmentIdentity ? <MediaImage asset={fragmentIdentity} alt="" eager /> : null}
        </div>
        <div ref={painRef} className={styles.painAnchor}>
          {pain ? <MediaImage asset={pain} alt="A personal emotional fragment" objectFit="contain" sizes="(max-width: 760px) 72vw, 34vw" eager /> : <span className={styles.painFallback} aria-hidden="true" />}
        </div>
      </div>

      <p className={styles.copy} aria-live="polite">
        <span ref={firstRef}>{S09_COPY.first}</span>
        <span ref={secondRef}>{S09_COPY.second}</span>
        <span ref={thirdRef}>{S09_COPY.third}</span>
        <span ref={finalRef} className={styles.finalLine} aria-hidden={!finalVisible}>{S09_COPY.final}</span>
      </p>

      <button
        ref={holdRef}
        type="button"
        className={styles.holdControl}
        disabled={!interactionAvailable}
        aria-label="Удерживай, чтобы принять часть боли"
        aria-describedby="s09-hold-instruction"
        onPointerEnter={() => { if (interactionAvailable) visual.setCursorMode("ABSORPTION"); }}
        onPointerLeave={() => { if (pointerIdRef.current === null && !completedRef.current) visual.setCursorMode("DIMMED"); }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerRelease}
        onPointerCancel={handlePointerRelease}
        onLostPointerCapture={() => {
          if (pointerIdRef.current !== null) {
            pointerIdRef.current = null;
            endHold();
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={endHold}
        onKeyUp={(event) => {
          if (event.code === "Space" || event.key === "Enter") {
            event.preventDefault();
            endHold();
          }
        }}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span className={styles.holdField} aria-hidden="true" />
        <span className={styles.holdCore} aria-hidden="true" />
        <span id="s09-hold-instruction" className={styles.holdLabel}>удерживай</span>
      </button>
    </section>
  );
}
