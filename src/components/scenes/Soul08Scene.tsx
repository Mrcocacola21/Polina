"use client";

import gsap from "gsap";
import { useCallback, useEffect, useRef, useState } from "react";

import { MediaImage } from "@/components/media/MediaImage";
import { useAudioEngine, useSceneAudio } from "@/lib/audio/AudioEngineContext";
import {
  createS08RunGate,
  isS08AlreadyCommitted,
  phase9CollectionAllowsContinue,
  PHASE9_MUSIC_STATE,
  S08_AUDIO_CUE_ORDER,
  S08_CAMERA,
  S08_COLLECTION,
  S08_COPY,
  S08_TIMING,
  type S08AudioCue,
} from "@/lib/cinematic/phase9";
import { COLLECTION_SCENE_SCALE, DUCK_PRESETS, FILM_MIX } from "@/lib/cinematic/directing";
import { useSceneRuntime } from "@/lib/cinematic/SceneRuntimeContext";
import { useMediaAsset } from "@/lib/media/MediaPreloadContext";
import { useSceneSoulCollection, useSoulCollectionRuntime } from "@/lib/souls/SoulCollectionContext";
import type { ParticleFieldController } from "@/lib/visuals/VisualRuntime";
import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";
import { createSceneVisualScopeId } from "@/lib/visuals/VisualScope";

import styles from "./Soul08Scene.module.css";

const FRAGMENTS = Object.freeze([
  { className: styles.fragmentA, viewBox: "25 20 315 575" },
  { className: styles.fragmentB, viewBox: "355 20 260 590" },
  { className: styles.fragmentC, viewBox: "625 20 595 590" },
  { className: styles.fragmentD, viewBox: "20 590 315 610" },
  { className: styles.fragmentE, viewBox: "340 590 300 610" },
  { className: styles.fragmentF, viewBox: "610 590 320 590" },
  { className: styles.fragmentG, viewBox: "910 590 320 610" },
]);

function centerOf(element: HTMLElement | null): readonly [number, number] | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return [rect.left + rect.width / 2, rect.top + rect.height / 2];
}

export function Soul08Scene() {
  const rootRef = useRef<HTMLElement>(null);
  const impactFrameRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const hallRef = useRef<HTMLDivElement>(null);
  const sigilRef = useRef<HTMLDivElement>(null);
  const sigilRingRef = useRef<HTMLSpanElement>(null);
  const relicRef = useRef<HTMLDivElement>(null);
  const ruptureRef = useRef<HTMLDivElement>(null);
  const impactWashRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLSpanElement>(null);
  const secondRef = useRef<HTMLSpanElement>(null);
  const fragmentRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const particlesRef = useRef<ParticleFieldController | null>(null);
  const cameraImpactRef = useRef<gsap.core.Timeline | null>(null);
  const runGateRef = useRef(createS08RunGate());
  const [collectionStatus, setCollectionStatus] = useState("pending");
  const [sceneBeat, setSceneBeat] = useState("entry");
  const { phase, runId, completeEnter, completeExit, setCanAdvance, setContinueVisible } =
    useSceneRuntime();
  const hall = useMediaAsset("visual:sections.section08Asset02");
  const sigil = useMediaAsset("visual:sections.section08Asset01");
  const fragments = useMediaAsset("visual:sections.section08Asset03");
  const relic = useMediaAsset("visual:screens.queenCantDie");
  const displacement = useMediaAsset("visual:global.asset06");
  const audio = useAudioEngine();
  const sceneAudio = useSceneAudio();
  const { collect } = useSceneSoulCollection();
  const collectionRuntime = useSoulCollectionRuntime();
  const visual = useVisualRuntime();
  const scopeId = createSceneVisualScopeId("S08", runId);
  const fragmentCount = visual.quality === "HIGH" ? 7 : visual.quality === "LOW" ? 3 : 5;

  const playCue = useCallback((cue: S08AudioCue) => {
    if (!runGateRef.current.takeCue(cue) || !audio.getSnapshot().isUnlocked) return;
    const options = cue === S08_AUDIO_CUE_ORDER[0]
      ? { gain: FILM_MIX.sfx.s08Arrival, duckMusic: DUCK_PRESETS.queenArrival }
      : cue === S08_AUDIO_CUE_ORDER[1]
        ? { gain: FILM_MIX.sfx.s08Sigil }
        : cue === S08_AUDIO_CUE_ORDER[2]
          ? { gain: FILM_MIX.sfx.s08Fragments, pan: 0.12 }
          : { gain: FILM_MIX.sfx.s08Declaration, duckMusic: DUCK_PRESETS.queenDeclaration };
    void sceneAudio.playSfx(cue, options);
  }, [audio, sceneAudio]);

  const runCameraImpact = useCallback((strong: boolean) => {
    const target = impactFrameRef.current;
    if (!target) return;
    cameraImpactRef.current?.kill();
    const amount = visual.motionIntensity;
    const impact = strong ? S08_CAMERA.secondImpact : S08_CAMERA.firstImpact;
    const timeline = gsap.timeline({
      onComplete: () => {
        gsap.set(target, { ...S08_CAMERA.start });
        cameraImpactRef.current = null;
      },
    });
    timeline.to(target, {
      x: impact.x * amount,
      y: impact.y * amount,
      scale: 1 + (impact.scale - 1) * amount,
      duration: strong ? 0.075 : 0.06,
      ease: "power2.out",
    });
    timeline.to(target, { x: 0, y: 0, scale: 1, duration: strong ? 0.42 : 0.3, ease: "elastic.out(1, .58)" });
    cameraImpactRef.current = timeline;
  }, [visual]);

  const scheduleContinue = useCallback(() => {
    const timer = window.setTimeout(() => {
      setCanAdvance(true);
      setContinueVisible(true);
      setSceneBeat("complete");
    }, S08_TIMING.continueDelay * 1000);
    visual.addScopeCleanup(scopeId, () => window.clearTimeout(timer));
  }, [scopeId, setCanAdvance, setContinueVisible, visual]);

  const runCollection = useCallback(async () => {
    if (!runGateRef.current.beginCollection()) return;
    collectionRuntime.showHud();
    const existing = collectionRuntime
      .getSnapshot()
      .slots.find((slot) => slot.soulId === S08_COLLECTION.soulId);
    if (isS08AlreadyCommitted(existing?.status)) {
      setCollectionStatus("already-collected");
      scheduleContinue();
      return;
    }
    const point = centerOf(sigilRef.current);
    if (!point) {
      setCollectionStatus("failed");
      return;
    }
    setCollectionStatus("collecting");
    setSceneBeat("collection");
    const result = await collect({
      source: { type: "POINT", point },
      variant: S08_COLLECTION.variant,
      visualState: S08_COLLECTION.visualState,
      timingScale: COLLECTION_SCENE_SCALE.S08,
    });
    setCollectionStatus(result.status);
    if (phase9CollectionAllowsContinue(result.status)) scheduleContinue();
    else if (process.env.NODE_ENV === "development") {
      console.warn("S08 remains gated because SOUL_08 did not commit.", result);
    }
  }, [collect, collectionRuntime, scheduleContinue]);

  useEffect(() => {
    collectionRuntime.showHud();
    visual.setCursorMode("DIMMED");
    visual.setFog("CRIMSON", 0.17, 0.8);
    visual.setGrain(0.025);
    visual.setVignette(0.74, 0.78);
    visual.setVignetteCenter(50, 46);
    visual.setLightLeak(0.018, { position: [50, 44], scale: 1.15, rotation: 0, drift: false });
    const particles = visual.spawnParticleField({
      mode: "AMBIENT_DRIFT",
      count: 62,
      position: [0, -0.15, 0],
      spread: [8.4, 4.8, 2.8],
      size: [0.012, 0.052],
      opacity: 0.18,
      velocity: 0.025,
      drift: 0.05,
      color: "#a9152f",
      depthRange: [-2.4, 2.2],
      scopeId,
    });
    particlesRef.current = particles;
    return () => {
      cameraImpactRef.current?.kill();
      cameraImpactRef.current = null;
      particlesRef.current = null;
      particles.dispose();
      collectionRuntime.showHud();
      visual.setCursorMode("DEFAULT");
      visual.fadeFog(0, 0.2);
      visual.setLightLeak(0, { drift: false });
      visual.setGrain(0.055);
      visual.setVignette(0.42, 0.62);
      visual.setVignetteCenter(50, 50);
    };
  }, [collectionRuntime, scopeId, visual]);

  useEffect(() => {
    if (phase !== "entering") return;
    if (audio.getSnapshot().isUnlocked) {
      void audio.setMusicState(PHASE9_MUSIC_STATE, { gain: FILM_MIX.music.s08, gainRampSeconds: 1.1 });
    }
    gsap.set(impactFrameRef.current, { ...S08_CAMERA.start });
    gsap.set(cameraRef.current, { ...S08_CAMERA.start });
    const timeline = gsap.timeline({ onComplete: completeEnter });
    timeline.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.18, ease: "none" });
    timeline.fromTo(ruptureRef.current, { opacity: 0, xPercent: -1.5 }, { opacity: 0.46, xPercent: 1.5, duration: 0.12, ease: "power2.out" }, 0.06);
    timeline.to(ruptureRef.current, { opacity: 0, xPercent: 0, duration: 0.13, ease: "power2.in" }, 0.18);
    timeline.call(() => playCue(S08_AUDIO_CUE_ORDER[0]), [], 0.2);
    timeline.fromTo(hallRef.current, {
      opacity: 0,
      filter: "brightness(.2) contrast(1.18) saturate(.35)",
      scale: 1.025,
    }, {
      opacity: 0.88,
      filter: "brightness(.54) contrast(1.08) saturate(.76)",
      scale: 1,
      duration: S08_TIMING.entryReveal,
      ease: "power2.out",
    }, 0.18);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [audio, completeEnter, phase, playCue, scopeId, visual]);

  useEffect(() => {
    if (phase !== "active") return;
    const fragmentElements = fragmentRefs.current.filter((element): element is HTMLSpanElement => Boolean(element));
    const cameraDuration = S08_TIMING.collection - 0.6;
    const timeline = gsap.timeline();
    timeline.to(cameraRef.current, {
      ...S08_CAMERA.end,
      duration: cameraDuration,
      ease: "sine.inOut",
    }, 0);
    timeline.call(() => setSceneBeat("sigil"), [], S08_TIMING.sigilPresence);
    timeline.fromTo(sigilRef.current, {
      opacity: 0,
      scale: 0.72,
      filter: "brightness(.35) saturate(.45) blur(2px)",
      rotation: -0.8,
    }, {
      opacity: 0.56,
      scale: 1,
      filter: "brightness(.72) saturate(.78) blur(0px)",
      rotation: 0,
      duration: 1.55,
      ease: "sine.out",
    }, S08_TIMING.sigilPresence);
    timeline.call(() => {
      setSceneBeat("sigil-active");
      playCue(S08_AUDIO_CUE_ORDER[1]);
      visual.setFogOpacity(0.21, 0.9);
      visual.setLightLeak(0.075, { position: [50, 42], scale: 1.08, drift: false });
      particlesRef.current?.update({ opacity: 0.24, drift: 0.065 });
    }, [], S08_TIMING.sigilActivation);
    timeline.fromTo(sigilRingRef.current, { opacity: 0, scale: 0.62 }, { opacity: 0.68, scale: 1.25, duration: 0.62, ease: "sine.out" }, S08_TIMING.sigilActivation);
    timeline.to(sigilRingRef.current, { opacity: 0.16, scale: 1.55, duration: 0.7, ease: "sine.in" });
    timeline.to({}, { duration: 0.01, onComplete: () => visual.setLightLeak(0.022, { drift: false }) }, S08_TIMING.sigilActivation + 0.8);
    timeline.call(() => setSceneBeat("relic"), [], S08_TIMING.screenshot);
    timeline.fromTo(relicRef.current, {
      opacity: 0,
      filter: "blur(10px) brightness(.34) saturate(.45)",
      y: 14,
      scale: 0.965,
    }, {
      opacity: 0.52,
      filter: "blur(0px) brightness(.7) saturate(.72)",
      y: 0,
      scale: 1,
      duration: 1.35,
      ease: "power2.out",
    }, S08_TIMING.screenshot);
    timeline.call(() => {
      setSceneBeat("first-declaration");
      collectionRuntime.dimHud();
      runCameraImpact(false);
    }, [], S08_TIMING.firstDeclaration);
    timeline.fromTo(firstRef.current, { opacity: 0, filter: "blur(5px)", scale: 1.035 }, {
      opacity: 1,
      filter: "blur(0px)",
      scale: 1,
      duration: 0.38,
      ease: "power3.out",
    }, S08_TIMING.firstDeclaration);
    timeline.call(() => {
      setSceneBeat("fragments");
      playCue(S08_AUDIO_CUE_ORDER[2]);
      particlesRef.current?.burst();
    }, [], S08_TIMING.fragments);
    timeline.fromTo(fragmentElements, {
      opacity: 0,
      xPercent: -22,
      yPercent: 12,
      scale: 0.82,
    }, {
      opacity: 0.74,
      xPercent: 18,
      yPercent: -7,
      scale: 1,
      duration: 2.15,
      stagger: 0.08,
      ease: "power2.out",
    }, S08_TIMING.fragments);
    timeline.to(firstRef.current, { opacity: 0, filter: "blur(4px)", scale: 0.985, duration: 0.55, ease: "sine.in" }, S08_TIMING.fragments + 0.55);
    timeline.call(() => {
      setSceneBeat("second-declaration");
      playCue(S08_AUDIO_CUE_ORDER[3]);
      runCameraImpact(true);
      visual.setFogOpacity(0.24, 0.35);
      visual.setLightLeak(0.13, { position: [52, 46], scale: 1.22, rotation: 3, drift: false });
    }, [], S08_TIMING.secondDeclaration);
    timeline.fromTo(secondRef.current, { opacity: 0, filter: "blur(4px)", scale: 1.045 }, {
      opacity: 1,
      filter: "blur(0px)",
      scale: 1,
      duration: 0.34,
      ease: "power3.out",
    }, S08_TIMING.secondDeclaration);
    timeline.fromTo(impactWashRef.current, { opacity: 0 }, { opacity: 0.34, duration: 0.08, ease: "none" }, S08_TIMING.secondDeclaration);
    timeline.to(impactWashRef.current, { opacity: 0, duration: 0.5, ease: "power2.out" });
    timeline.call(() => {
      setSceneBeat("deescalate");
      visual.setFogOpacity(0.14, 1.0);
      visual.setLightLeak(0.018, { scale: 1.06, rotation: 0, drift: false });
      particlesRef.current?.update({ mode: "AMBIENT_DRIFT", opacity: 0.12, velocity: 0.012, drift: 0.025 });
    }, [], S08_TIMING.deescalate);
    timeline.to(secondRef.current, { opacity: 0, filter: "blur(5px)", scale: 0.99, duration: 0.75, ease: "sine.in" }, S08_TIMING.deescalate);
    timeline.to(fragmentElements, { opacity: 0.16, xPercent: 24, scale: 0.92, duration: 1.2, ease: "sine.inOut" }, S08_TIMING.deescalate);
    timeline.to(relicRef.current, { opacity: 0.2, filter: "blur(2px) brightness(.45) saturate(.5)", scale: 0.985, duration: 1.05 }, S08_TIMING.deescalate);
    timeline.to(sigilRef.current, { opacity: 0.92, filter: "brightness(.92) saturate(.92)", scale: 0.82, duration: 1.2, ease: "power2.inOut" }, S08_TIMING.collection - 1.15);
    timeline.call(() => {
      collectionRuntime.showHud();
      visual.setFogOpacity(0.16, 0.6);
      void runCollection();
    }, [], S08_TIMING.collection);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [collectionRuntime, phase, playCue, runCameraImpact, runCollection, scopeId, visual]);

  useEffect(() => {
    if (phase !== "exiting") return;
    collectionRuntime.showHud();
    particlesRef.current?.dissolve();
    visual.setLightLeak(0, { drift: false });
    visual.fadeFog(0.025, 0.9);
    const fragmentsToAsh = fragmentRefs.current.filter((element): element is HTMLSpanElement => Boolean(element));
    const timeline = gsap.timeline({ onComplete: completeExit });
    timeline.to(fragmentsToAsh, { opacity: 0.06, filter: "grayscale(1) brightness(.25) blur(2px)", yPercent: 34, scale: 0.52, duration: 0.9, ease: "power2.in" });
    timeline.to(sigilRef.current, { opacity: 0.12, scale: 0.26, filter: "brightness(.32) saturate(.2)", duration: 0.82, ease: "power2.in" }, 0);
    timeline.to([hallRef.current, relicRef.current], { opacity: 0.04, filter: "brightness(.18) saturate(.2)", duration: 1.05, ease: "power2.inOut" }, 0.18);
    timeline.to(rootRef.current, { opacity: 0, duration: 0.38, ease: "sine.in" }, 0.82);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [collectionRuntime, completeExit, phase, scopeId, visual]);

  return (
    <section
      ref={rootRef}
      className={styles.scene}
      data-testid="s08-scene"
      data-scene-phase={phase}
      data-scene-beat={sceneBeat}
      data-collection-status={collectionStatus}
      data-music-state={PHASE9_MUSIC_STATE}
      aria-label="Queen"
    >
      <div ref={ruptureRef} className={styles.rupture} aria-hidden="true">
        {displacement ? <MediaImage asset={displacement} alt="" eager /> : null}
      </div>
      <div ref={impactFrameRef} className={styles.impactFrame}>
        <div ref={cameraRef} className={styles.camera}>
          <div ref={hallRef} className={styles.hall} aria-hidden="true">
            {hall ? <MediaImage asset={hall} alt="" eager /> : null}
          </div>
          <div ref={relicRef} className={styles.relic}>
            {relic ? <MediaImage asset={relic} alt="A personal memory" objectFit="contain" sizes="(max-width: 760px) 56vw, 24vw" eager /> : null}
          </div>
          <div ref={sigilRef} className={styles.sigil} aria-hidden="true">
            {sigil ? (
              <span
                className={styles.sigilTexture}
                style={{
                  backgroundImage: `url("${sigil.url}")`,
                  maskImage: `url("${sigil.url}")`,
                  WebkitMaskImage: `url("${sigil.url}")`,
                }}
              />
            ) : null}
            <span ref={sigilRingRef} className={styles.sigilRing} />
            <span className={styles.sigilCore} />
          </div>
        </div>
      </div>
      <div className={styles.fragments} aria-hidden="true">
        {fragments ? FRAGMENTS.slice(0, fragmentCount).map((fragment, index) => (
          <span
            key={fragment.className}
            ref={(element) => { fragmentRefs.current[index] = element; }}
            className={`${styles.fragment} ${fragment.className}`}
          >
            <svg
              className={styles.fragmentTexture}
              viewBox={fragment.viewBox}
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                <filter id={`queen-black-key-${index}`} colorInterpolationFilters="sRGB">
                  <feColorMatrix
                    type="matrix"
                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  .45 .65 .25 0 -.015"
                  />
                </filter>
              </defs>
              <image
                href={fragments.url}
                x="0"
                y="0"
                width="1254"
                height="1254"
                filter={`url(#queen-black-key-${index})`}
              />
            </svg>
          </span>
        )) : null}
      </div>
      <p className={styles.declaration} aria-label={S08_COPY.full}>
        <span ref={firstRef} className={styles.first}>{S08_COPY.first}</span>
        <span className={styles.phraseJoin} aria-hidden="true">, </span>
        <span ref={secondRef} className={styles.second}>{S08_COPY.second}</span>
      </p>
      <div ref={impactWashRef} className={styles.impactWash} aria-hidden="true" />
    </section>
  );
}
