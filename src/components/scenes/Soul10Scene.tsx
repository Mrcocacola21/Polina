"use client";

import gsap from "gsap";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { MediaImage } from "@/components/media/MediaImage";
import { useAudioEngine, useSceneAudio } from "@/lib/audio/AudioEngineContext";
import type { MusicToneHandle, ProceduralHandle } from "@/lib/audio/types";
import {
  isS10AlreadyCommitted,
  PHASE11_MUSIC_STATE,
  phase11CollectionAllowsContinue,
  S10_AUDIO_LEVELS,
  S10_COLLECTION,
  S10_COPY,
  S10_DISTORTION,
  S10_TIMING,
  S10_VISUAL_LEVELS,
} from "@/lib/cinematic/phase11";
import { COLLECTION_SCENE_SCALE, FILM_MIX } from "@/lib/cinematic/directing";
import { useSceneRuntime } from "@/lib/cinematic/SceneRuntimeContext";
import { useMediaAsset } from "@/lib/media/MediaPreloadContext";
import { useSceneSoulCollection, useSoulCollectionRuntime } from "@/lib/souls/SoulCollectionContext";
import type { ParticleFieldController } from "@/lib/visuals/VisualRuntime";
import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";
import { createSceneVisualScopeId } from "@/lib/visuals/VisualScope";

import styles from "./Soul10Scene.module.css";

type DistortionProfile = Readonly<{ jitter: number; liquid: number; edge: number }>;
type TextureStyle = CSSProperties & Record<`--${string}`, string | number>;

function centerOf(element: HTMLElement | null): readonly [number, number] | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0
    ? [rect.left + rect.width / 2, rect.top + rect.height / 2]
    : null;
}

export function Soul10Scene() {
  const rootRef = useRef<HTMLElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const environmentRef = useRef<HTMLDivElement>(null);
  const edgeRef = useRef<HTMLDivElement>(null);
  const pulseRef = useRef<HTMLSpanElement>(null);
  const lineRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const rumbleRef = useRef<ProceduralHandle | null>(null);
  const toneRef = useRef<MusicToneHandle | null>(null);
  const particlesRef = useRef<ParticleFieldController | null>(null);
  const collectionStartedRef = useRef(false);
  const timelineStartedRef = useRef(false);
  const activeRunRef = useRef(true);
  const [sceneBeat, setSceneBeat] = useState("entry");
  const [collectionStatus, setCollectionStatus] = useState("pending");
  const { phase, runId, completeEnter, completeExit, setCanAdvance, setContinueVisible } = useSceneRuntime();
  const environment = useMediaAsset("visual:sections.section10Asset01");
  const displacementA = useMediaAsset("visual:sections.section10Asset02VariantA");
  const displacementB = useMediaAsset("visual:sections.section10Asset02VariantB");
  const displacementC = useMediaAsset("visual:sections.section10Asset02VariantC");
  const audio = useAudioEngine();
  const sceneAudio = useSceneAudio();
  const { collect } = useSceneSoulCollection();
  const collectionRuntime = useSoulCollectionRuntime();
  const visual = useVisualRuntime();
  const scopeId = createSceneVisualScopeId("S10", runId);

  const textureStyle: TextureStyle = {
    "--map-a": displacementA ? `url("${displacementA.url}")` : "none",
    "--map-b": displacementB ? `url("${displacementB.url}")` : "none",
    "--map-c": displacementC ? `url("${displacementC.url}")` : "none",
  };

  const applyDistortion = useCallback((index: number, profile: DistortionProfile) => {
    const element = lineRefs.current[index];
    element?.style.setProperty("--jitter", String(profile.jitter));
    element?.style.setProperty("--liquid", String(profile.liquid));
    element?.style.setProperty("--edge", String(profile.edge));
    edgeRef.current?.style.setProperty("--edge-pressure", String(profile.edge));
  }, []);

  const applyTone = useCallback((tone: Readonly<{ frequency: number; presence: number }>, rampSeconds: number) => {
    if (!audio.getSnapshot().isUnlocked) return;
    toneRef.current = sceneAudio.applyMusicTone({ ...tone, rampSeconds });
  }, [audio, sceneAudio]);

  const scheduleContinue = useCallback(() => {
    const timer = window.setTimeout(() => {
      if (!activeRunRef.current) return;
      collectionRuntime.dimHud();
      setSceneBeat("complete");
      setCanAdvance(true);
      setContinueVisible(true);
    }, S10_TIMING.hudSettle * 1000);
    visual.addScopeCleanup(scopeId, () => window.clearTimeout(timer));
  }, [collectionRuntime, scopeId, setCanAdvance, setContinueVisible, visual]);

  const runCollection = useCallback(async () => {
    if (collectionStartedRef.current) return;
    collectionStartedRef.current = true;
    setSceneBeat("collection");
    setCollectionStatus("collecting");
    lineRefs.current.forEach((line) => {
      line?.style.setProperty("--jitter", "0");
      line?.style.setProperty("--liquid", "0");
      line?.style.setProperty("--edge", "0");
    });
    edgeRef.current?.style.setProperty("--edge-pressure", "0");
    rumbleRef.current?.setGain(S10_AUDIO_LEVELS.rumble.off, 1.2);
    rumbleRef.current?.stop({ fadeSeconds: 1.35 });
    rumbleRef.current = null;
    applyTone(S10_AUDIO_LEVELS.tone.collection, 2.2);
    visual.setVignette(S10_VISUAL_LEVELS.vignette.collection, 0.86);
    particlesRef.current?.update({ mode: "ATTRACT", attractionStrength: 1.15, opacity: 0.16, velocity: 0.06 });

    const existing = collectionRuntime.getSnapshot().slots.find((slot) => slot.soulId === S10_COLLECTION.soulId);
    if (isS10AlreadyCommitted(existing?.status)) {
      setCollectionStatus("already-collected");
      scheduleContinue();
      return;
    }
    const point = centerOf(pulseRef.current);
    if (!point) {
      setCollectionStatus("failed");
      return;
    }
    const result = await collect({
      source: { type: "POINT", point },
      variant: S10_COLLECTION.variant,
      visualState: S10_COLLECTION.visualState,
      timingScale: COLLECTION_SCENE_SCALE.S10,
    });
    if (!activeRunRef.current) return;
    setCollectionStatus(result.status);
    if (phase11CollectionAllowsContinue(result.status)) scheduleContinue();
  }, [applyTone, collect, collectionRuntime, scheduleContinue, visual]);

  useEffect(() => {
    activeRunRef.current = true;
    collectionRuntime.showHud();
    visual.setCursorMode("DIMMED");
    visual.setFog(null, 0, 1.2);
    visual.setLightLeak(0, { drift: false });
    visual.setGrain(0.022);
    visual.setVignette(S10_VISUAL_LEVELS.vignette.entry, 0.82);
    visual.setVignetteCenter(50, 49);
    const particleCount = S10_VISUAL_LEVELS.particleCount.high;
    const particles = visual.spawnParticleField({
      mode: "AMBIENT_DRIFT",
      count: particleCount,
      position: [0, -0.08, -0.4],
      spread: [3.2, 2.1, 1.3],
      size: [0.008, 0.026],
      opacity: 0.075,
      velocity: 0.006,
      drift: 0.012,
      color: "#63101d",
      depthRange: [-1.2, 0.8],
      scopeId,
    });
    particlesRef.current = particles;
    return () => {
      activeRunRef.current = false;
      rumbleRef.current?.stop({ fadeSeconds: 0.08 });
      toneRef.current?.release(0.18);
      rumbleRef.current = null;
      toneRef.current = null;
      particlesRef.current = null;
      particles.dispose();
      collectionRuntime.showHud();
      visual.setCursorMode("DEFAULT");
      visual.setFog(null, 0, 0.15);
      visual.setLightLeak(0, { drift: false });
      visual.setGrain(0.055);
      visual.setVignette(0.42, 0.62);
      visual.setVignetteCenter(50, 50);
    };
  }, [collectionRuntime, scopeId, visual]);

  useEffect(() => {
    if (phase !== "entering") return;
    if (audio.getSnapshot().isUnlocked) {
      if (audio.getSnapshot().music.state !== PHASE11_MUSIC_STATE) {
        void audio.crossfadeMusic(PHASE11_MUSIC_STATE, {
          crossfadeSeconds: S10_TIMING.directMusicCrossfade,
          gain: FILM_MIX.music.s10,
        });
      } else {
        void audio.setMusicState(PHASE11_MUSIC_STATE, { gain: FILM_MIX.music.s10, gainRampSeconds: 1.8 });
      }
      rumbleRef.current = sceneAudio.createLowRumble({ frequency: 43, intensity: 1, gain: S10_AUDIO_LEVELS.rumble.entry });
      applyTone(S10_AUDIO_LEVELS.tone.entry, 2.6);
    }
    const timeline = gsap.timeline({ onComplete: completeEnter });
    timeline.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: S10_TIMING.entryReveal, ease: "sine.out" });
    timeline.fromTo(environmentRef.current, {
      opacity: 0,
      filter: "brightness(.12) saturate(.18) blur(3px)",
      scale: 1.006,
    }, {
      opacity: 0.78,
      filter: "brightness(.38) saturate(.46) blur(0px)",
      scale: 1,
      duration: S10_TIMING.entryReveal,
      ease: "sine.out",
    }, 0);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [applyTone, audio, completeEnter, phase, sceneAudio, scopeId, visual]);

  useEffect(() => {
    if (phase !== "active" || timelineStartedRef.current) return;
    timelineStartedRef.current = true;
    const lines = lineRefs.current;
    const reveal = (index: number, profile: DistortionProfile, beat: string) => {
      setSceneBeat(beat);
      applyDistortion(index, visual.motionIntensity < 0.5
        ? { jitter: profile.jitter * 0.24, liquid: profile.liquid * 0.2, edge: profile.edge * 0.2 }
        : profile);
    };
    const timeline = gsap.timeline();
    timeline.to(cameraRef.current, {
      scale: visual.motionIntensity < 0.5 ? S10_VISUAL_LEVELS.reducedCameraScale : S10_VISUAL_LEVELS.cameraScale,
      duration: S10_TIMING.collection,
      ease: "sine.inOut",
    }, 0);
    timeline.call(() => {
      reveal(0, S10_DISTORTION.overthinking, "first");
      rumbleRef.current?.setGain(S10_AUDIO_LEVELS.rumble.early, 2.2);
    }, [], S10_TIMING.first);
    timeline.fromTo(lines[0], { opacity: 0, filter: "blur(5px)", y: 7 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 1.35, ease: "sine.out" }, S10_TIMING.first);
    timeline.call(() => {
      reveal(1, S10_DISTORTION.stable, "overthinking");
      rumbleRef.current?.setGain(S10_AUDIO_LEVELS.rumble.peak, 2.4);
      applyTone(S10_AUDIO_LEVELS.tone.overthinking, 2.8);
      visual.setVignette(S10_VISUAL_LEVELS.vignette.middle, 0.78);
    }, [], S10_TIMING.second);
    timeline.to(lines[0], { opacity: 0, filter: "blur(2px)", duration: 0.55, ease: "sine.inOut" }, S10_TIMING.second - 0.45);
    timeline.fromTo(lines[1], { opacity: 0, filter: "blur(3px)", y: 5 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 1.2, ease: "sine.out" }, S10_TIMING.second + 0.18);
    timeline.call(() => {
      setSceneBeat("calm");
      applyDistortion(2, S10_DISTORTION.stable);
      edgeRef.current?.style.setProperty("--edge-pressure", "0");
      rumbleRef.current?.setGain(S10_AUDIO_LEVELS.rumble.calm, 1.25);
      applyTone(S10_AUDIO_LEVELS.tone.calm, 1.35);
      visual.setVignette(S10_VISUAL_LEVELS.vignette.calm, 0.9);
      visual.setCursorMode("DIMMED");
      pulseRef.current?.style.setProperty("--pulse-duration", "3.2s");
    }, [], S10_TIMING.calm);
    timeline.to([lines[0], lines[1]], { opacity: 0, filter: "blur(1.5px)", duration: 0.9, ease: "sine.inOut" }, S10_TIMING.calm - 0.4);
    timeline.fromTo(lines[2], { opacity: 0, filter: "blur(3px)", y: 4 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 1.15, ease: "sine.out" }, S10_TIMING.calm);
    timeline.call(() => {
      reveal(3, S10_DISTORTION.returningFear, "fear-returns");
      rumbleRef.current?.setGain(S10_AUDIO_LEVELS.rumble.fear, 2.1);
      applyTone(S10_AUDIO_LEVELS.tone.fear, 2.5);
      visual.setVignette(S10_VISUAL_LEVELS.vignette.fear, 0.76);
      pulseRef.current?.style.setProperty("--pulse-duration", "2.45s");
    }, [], S10_TIMING.fear);
    timeline.to(lines[2], { opacity: 0.24, duration: 1.2, ease: "sine.inOut" }, S10_TIMING.fear);
    timeline.fromTo(lines[3], { opacity: 0, filter: "blur(4px)", y: 6 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 1.4, ease: "sine.out" }, S10_TIMING.fear);
    timeline.call(() => reveal(4, S10_DISTORTION.loss, "loss"), [], S10_TIMING.loss);
    timeline.to(lines[3], { opacity: 0.24, duration: 1.1 }, S10_TIMING.loss);
    timeline.fromTo(lines[4], { opacity: 0, filter: "blur(4px)", y: 6 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 1.15, ease: "sine.out" }, S10_TIMING.loss);
    timeline.call(() => reveal(5, S10_DISTORTION.interest, "interest"), [], S10_TIMING.interest);
    timeline.to(lines[4], { opacity: 0.32, duration: 0.9 }, S10_TIMING.interest);
    timeline.fromTo(lines[5], { opacity: 0, filter: "blur(4px)", y: 5 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 1.1, ease: "sine.out" }, S10_TIMING.interest);
    timeline.call(() => {
      reveal(6, S10_DISTORTION.finalFear, "final-fear");
      rumbleRef.current?.setGain(S10_AUDIO_LEVELS.rumble.final, 1.8);
      applyTone(S10_AUDIO_LEVELS.tone.final, 2.3);
      visual.setVignette(S10_VISUAL_LEVELS.vignette.final, 0.82);
    }, [], S10_TIMING.finalFear);
    timeline.to(lines[5], { opacity: 0.26, duration: 1 }, S10_TIMING.finalFear);
    timeline.fromTo(lines[6], { opacity: 0, filter: "blur(4px)", y: 5 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 1.25, ease: "sine.out" }, S10_TIMING.finalFear);
    timeline.call(() => {
      setSceneBeat("final-hold");
      particlesRef.current?.update({ opacity: 0.045, velocity: 0.003, drift: 0.006 });
    }, [], S10_TIMING.finalFear + 1.3);
    timeline.to(lines, { opacity: 0, filter: "blur(2px)", duration: 1.25, stagger: 0.035, ease: "sine.in" }, S10_TIMING.collection - 1.3);
    timeline.call(() => void runCollection(), [], S10_TIMING.collection);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [applyDistortion, applyTone, phase, runCollection, scopeId, visual]);

  useEffect(() => {
    if (phase !== "exiting") return;
    rumbleRef.current?.stop({ fadeSeconds: 0.2 });
    rumbleRef.current = null;
    particlesRef.current?.dissolve();
    visual.setCursorMode("HIDDEN");
    visual.setVignette(0.64, 0.92);
    const timeline = gsap.timeline({ onComplete: completeExit });
    timeline.to([environmentRef.current, edgeRef.current, pulseRef.current], { opacity: 0, duration: 1.25, ease: "sine.inOut" }, 0);
    timeline.to(rootRef.current, { opacity: 0, duration: S10_TIMING.exit, ease: "sine.inOut" }, 0);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [completeExit, phase, scopeId, visual]);

  return (
    <section
      ref={rootRef}
      className={styles.scene}
      style={textureStyle}
      data-testid="s10-scene"
      data-scene-phase={phase}
      data-scene-beat={sceneBeat}
      data-collection-status={collectionStatus}
      data-music-state={PHASE11_MUSIC_STATE}
      aria-label="Anxiety"
    >
      <div ref={cameraRef} className={styles.camera} aria-hidden="true">
        <div ref={environmentRef} className={styles.environment}>
          {environment ? <MediaImage asset={environment} alt="" eager /> : <span className={styles.environmentFallback} />}
        </div>
      </div>
      <div ref={edgeRef} className={styles.fragmentedEdge} aria-hidden="true" />
      <span ref={pulseRef} className={styles.pulse} aria-hidden="true" />

      <p className={styles.copy} aria-label={S10_COPY.full}>
        {S10_COPY.segments.map((segment, index) => (
          <span
            key={segment}
            ref={(element) => { lineRefs.current[index] = element; }}
            className={`${styles.line} ${index === 2 ? styles.calmLine : ""}`}
            aria-hidden="true"
          >
            <span className={styles.primary}>{segment}</span>
            <span className={`${styles.ghost} ${styles.ghostA}`}>{segment}</span>
            <span className={`${styles.ghost} ${styles.ghostB}`}>{segment}</span>
            <span className={`${styles.ghost} ${styles.ghostC}`}>{segment}</span>
          </span>
        ))}
      </p>
    </section>
  );
}
