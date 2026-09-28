"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";

import { MediaImage } from "@/components/media/MediaImage";
import { useCapabilities } from "@/lib/accessibility/CapabilityContext";
import { useAudioEngine, useSceneAudio } from "@/lib/audio/AudioEngineContext";
import type { AmbientHandle } from "@/lib/audio/types";
import {
  evaluateMemoryCameraSpline,
  PHASE7_MUSIC_STATE,
  phase7CollectionAllowsContinue,
  S03_COLLECTION,
  S03_COPY,
  S03_TIMING,
  type MemoryCameraFrame,
} from "@/lib/cinematic/phase7";
import { COLLECTION_SCENE_SCALE, FILM_MIX } from "@/lib/cinematic/directing";
import { MEMORY_TO_THREAD } from "@/lib/cinematic/memory-transition";
import { useSceneRuntime } from "@/lib/cinematic/SceneRuntimeContext";
import { useMediaAsset } from "@/lib/media/MediaPreloadContext";
import {
  useSceneSoulCollection,
  useSoulCollectionRuntime,
} from "@/lib/souls/SoulCollectionContext";
import type { ParticleFieldController } from "@/lib/visuals/VisualRuntime";
import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";
import { createSceneVisualScopeId } from "@/lib/visuals/VisualScope";

import styles from "./Soul03Scene.module.css";

function centerOf(element: HTMLElement | null): readonly [number, number] | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return [rect.left + rect.width / 2, rect.top + rect.height / 2];
}

export function Soul03Scene() {
  const rootRef = useRef<HTMLElement>(null);
  const environmentRef = useRef<HTMLDivElement>(null);
  const streaksRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const memoryOneRef = useRef<HTMLDivElement>(null);
  const memoryTwoRef = useRef<HTMLDivElement>(null);
  const memoryThreeRef = useRef<HTMLDivElement>(null);
  const phraseOneRef = useRef<HTMLSpanElement>(null);
  const phraseTwoRef = useRef<HTMLSpanElement>(null);
  const ambienceRef = useRef<AmbientHandle | null>(null);
  const particlesRef = useRef<ParticleFieldController | null>(null);
  const collectionStartedRef = useRef(false);
  const cameraFrameRef = useRef<MemoryCameraFrame>(evaluateMemoryCameraSpline(0));
  const cameraInfluenceRef = useRef(1);
  const [collectionStatus, setCollectionStatus] = useState("pending");
  const { phase, runId, completeEnter, completeExit, setCanAdvance, setContinueVisible } =
    useSceneRuntime();
  const environment = useMediaAsset("visual:sections.section03Asset02");
  const streaks = useMediaAsset("visual:sections.section03Asset04");
  const together = useMediaAsset("visual:screens.together");
  const minecraft = useMediaAsset("visual:screens.minecraftTogether");
  const living = useMediaAsset("visual:screens.livingTogether");
  const audio = useAudioEngine();
  const sceneAudio = useSceneAudio();
  const { collect } = useSceneSoulCollection();
  const collectionRuntime = useSoulCollectionRuntime();
  const visual = useVisualRuntime();
  const capabilities = useCapabilities();
  const scopeId = createSceneVisualScopeId("S03", runId);

  useEffect(() => {
    collectionRuntime.showHud();
    visual.setCursorMode("DEFAULT");
    visual.setFog("CRIMSON", 0.13, 1.6);
    visual.setGrain(0.025);
    visual.setVignette(0.5, 0.76);
    visual.setLightLeak(0.018, {
      position: [62, 45],
      scale: 1.28,
      rotation: -8,
      drift: true,
    });
    const particles = visual.spawnParticleField({
      mode: "AMBIENT_DRIFT",
      count: 76,
      spread: [10, 6, 5],
      depthRange: [-4, 3],
      size: [0.012, 0.048],
      opacity: 0.2,
      velocity: 0.018,
      drift: 0.065,
      color: "#b32b42",
      scopeId,
    });
    particlesRef.current = particles;
    return () => {
      particlesRef.current = null;
      particles.dispose();
    };
  }, [collectionRuntime, scopeId, visual]);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let frame = 0;
    const update = () => {
      const path = cameraFrameRef.current;
      const driftTime = performance.now() / 1000;
      const driftX = capabilities.motionMode === "FULL" ? Math.sin(driftTime * 0.34) * 1.3 * cameraInfluenceRef.current : 0;
      const driftY = capabilities.motionMode === "FULL" ? Math.cos(driftTime * 0.29) * 0.8 * cameraInfluenceRef.current : 0;
      const driftZ = capabilities.motionMode === "FULL" ? Math.sin(driftTime * 0.22) * 0.5 * cameraInfluenceRef.current : 0;
      const pointerX = finePointer.matches && capabilities.motionMode === "FULL" && capabilities.visibility === "visible"
        ? visual.pointer.smoothed.x * 8 * cameraInfluenceRef.current
        : 0;
      const pointerY = finePointer.matches && capabilities.motionMode === "FULL" && capabilities.visibility === "visible"
        ? visual.pointer.smoothed.y * 6 * cameraInfluenceRef.current
        : 0;
      camera.style.transform = `translate3d(${(-path.x + pointerX + driftX).toFixed(2)}px, ${(-path.y - pointerY + driftY).toFixed(2)}px, ${(path.z + driftZ).toFixed(2)}px) rotateY(${path.yaw.toFixed(2)}deg) rotateZ(${path.roll.toFixed(2)}deg)`;
      frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [capabilities.motionMode, capabilities.visibility, visual]);

  useEffect(() => {
    if (phase !== "entering") return;
    const timeline = gsap.fromTo(
      rootRef.current,
      { opacity: 0, filter: "brightness(0.45)" },
      { opacity: 1, filter: "brightness(1)", duration: 1.15, ease: "power2.out" },
    );
    timeline.eventCallback("onComplete", completeEnter);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [completeEnter, phase, scopeId, visual]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const prepareTransitionLab = () => {
      cameraFrameRef.current = evaluateMemoryCameraSpline(1);
      cameraInfluenceRef.current = 1;
      gsap.set([memoryOneRef.current, memoryTwoRef.current, memoryThreeRef.current], {
        opacity: 1,
        filter: "blur(0px) saturate(0.92)",
        scale: 1,
      });
      gsap.set([phraseOneRef.current, phraseTwoRef.current], { opacity: 0 });
    };
    window.addEventListener("soulbound:memory-transition-lab-prepare", prepareTransitionLab);
    return () => window.removeEventListener("soulbound:memory-transition-lab-prepare", prepareTransitionLab);
  }, []);

  useEffect(() => {
    if (phase !== "active") return;
    if (audio.getSnapshot().isUnlocked) {
      void sceneAudio.playAmbient("MEMORY_SPACE", {
        gain: FILM_MIX.ambient.s03Memory,
        fadeInSeconds: 2.4,
        loop: true,
      }).then((handle) => {
        ambienceRef.current = handle;
      });
    }

    const playCue = (ref: string, gain: number, pan = 0) => {
      if (!audio.getSnapshot().isUnlocked) return;
      void sceneAudio.playSfx(ref, { gain, pan });
    };
    const revealMemory = (element: HTMLElement | null, at: number) => {
      if (!element) return;
      timeline.fromTo(
        element,
        { opacity: 0, filter: "blur(14px) saturate(0.72)", scale: 0.93 },
        {
          opacity: 1,
          filter: "blur(0px) saturate(0.92)",
          scale: 1,
          duration: 1.55,
          ease: "power2.out",
        },
        at,
      );
    };
    const cameraProgress = { value: 0 };
    const timeline = gsap.timeline();
    timeline.to(cameraProgress, {
      value: 1,
      duration: S03_TIMING.cameraDuration,
      ease: "sine.inOut",
      onUpdate: () => {
        cameraFrameRef.current = evaluateMemoryCameraSpline(cameraProgress.value);
      },
    }, 0);
    timeline.call(() => {
      if (audio.getSnapshot().isUnlocked) {
        void audio.setMusicState(PHASE7_MUSIC_STATE, {
          crossfadeSeconds: S03_TIMING.musicCrossfade,
          gain: FILM_MIX.music.s03,
        });
      }
    }, [], 0.9);
    revealMemory(memoryOneRef.current, S03_TIMING.memoryOne);
    timeline.call(
      () => playCue("audio:scenes.s03.cue01.a", FILM_MIX.sfx.s03Memory, 0.18),
      [],
      S03_TIMING.memoryOne,
    );
    revealMemory(memoryTwoRef.current, S03_TIMING.memoryTwo);
    timeline.call(
      () => playCue("audio:scenes.s03.cue01.b", FILM_MIX.sfx.s03Memory, -0.22),
      [],
      S03_TIMING.memoryTwo,
    );
    timeline.call(
      () => playCue("audio:scenes.s03.cue02", FILM_MIX.sfx.s03Pass, -0.36),
      [],
      S03_TIMING.memoryTwoPass,
    );
    revealMemory(memoryThreeRef.current, S03_TIMING.memoryThree);
    timeline.call(
      () => playCue("audio:scenes.s03.cue01.c", FILM_MIX.sfx.s03Memory, 0.28),
      [],
      S03_TIMING.memoryThree,
    );
    timeline.fromTo(phraseOneRef.current, {
      opacity: 0,
      filter: "blur(9px)",
      y: 12,
    }, {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      duration: 1.2,
      ease: "power2.out",
    }, S03_TIMING.phraseOne);
    timeline.fromTo(phraseTwoRef.current, {
      opacity: 0,
      filter: "blur(8px)",
      y: 10,
    }, {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      duration: 1.15,
      ease: "power2.out",
    }, S03_TIMING.phraseTwo);
    timeline.call(() => {
      particlesRef.current?.update({ velocity: 0.012, drift: 0.04, opacity: 0.14 });
      // GSAP invokes this after render; the declaration is stable for this keyed run.
      // eslint-disable-next-line react-hooks/immutability
      void runCollection();
    }, [], S03_TIMING.collection);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
    // The keyed scene run owns this complete timeline and its single collection beat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function runCollection() {
    if (collectionStartedRef.current) return;
    collectionStartedRef.current = true;
    const existing = collectionRuntime
      .getSnapshot()
      .slots.find((slot) => slot.soulId === S03_COLLECTION.soulId);
    if (existing?.status === "COLLECTED" || existing?.status === "RELEASED") {
      setCollectionStatus("already-collected");
      scheduleContinue();
      return;
    }
    const points = [
      centerOf(memoryOneRef.current),
      centerOf(memoryTwoRef.current),
      centerOf(memoryThreeRef.current),
    ].filter((point): point is readonly [number, number] => point !== null);
    if (points.length !== 3) return;
    const convergence = [window.innerWidth * 0.54, window.innerHeight * 0.48] as const;
    setCollectionStatus("collecting");
    const result = await collect({
      source: { type: "POINTS", points, convergence },
      variant: S03_COLLECTION.variant,
      visualState: S03_COLLECTION.visualState,
      timingScale: COLLECTION_SCENE_SCALE.S03,
    });
    setCollectionStatus(result.status);
    if (phase7CollectionAllowsContinue(result.status)) scheduleContinue();
    else if (process.env.NODE_ENV === "development") {
      console.warn("S03 remains gated because SOUL_03 did not commit.", result);
    }
  }

  function scheduleContinue() {
    const timer = window.setTimeout(() => {
      setCanAdvance(true);
      setContinueVisible(true);
    }, S03_TIMING.continueDelay * 1000);
    visual.addScopeCleanup(scopeId, () => window.clearTimeout(timer));
  }

  useEffect(() => {
    if (phase !== "exiting") return;
    const finalMemory = memoryOneRef.current;
    const recedingMemories = [memoryTwoRef.current, memoryThreeRef.current];
    const finalRect = finalMemory?.getBoundingClientRect();
    const targetX = window.innerWidth * 0.52;
    const targetY = window.innerHeight * 0.48;
    const centerX = finalRect ? finalRect.left + finalRect.width / 2 : targetX;
    const centerY = finalRect ? finalRect.top + finalRect.height / 2 : targetY;
    const reduced = capabilities.motionMode === "REDUCED";
    const cameraMotion = { value: cameraInfluenceRef.current };

    ambienceRef.current?.stop({ fadeSeconds: 2.8 });
    ambienceRef.current = null;
    visual.setCursorMode("DIMMED");
    visual.fadeFog(0.008, 3.55);
    visual.setLightLeak(0, { drift: false });
    particlesRef.current?.update({
      velocity: 0.0025,
      drift: 0.008,
      opacity: 0.025,
    });

    const timeline = gsap.timeline({ onComplete: completeExit });
    timeline.to(cameraMotion, {
      value: 0,
      duration: MEMORY_TO_THREAD.cameraDeceleration,
      ease: "power2.out",
      onUpdate: () => {
        cameraInfluenceRef.current = cameraMotion.value;
      },
    }, 0);
    timeline.to(streaksRef.current, {
      opacity: 0,
      filter: "saturate(0.45) brightness(0.5) blur(2px)",
      duration: 0.62,
      ease: "power2.out",
    }, 0.02);
    timeline.to([phraseOneRef.current, phraseTwoRef.current], {
      opacity: 0,
      filter: "blur(7px)",
      y: 6,
      duration: 0.52,
      stagger: 0.05,
      ease: "power2.in",
    }, 0.02);
    timeline.to(recedingMemories, {
      z: reduced ? -80 : -520,
      scale: reduced ? 0.94 : 0.72,
      opacity: 0,
      filter: "saturate(0.42) brightness(0.52) blur(8px)",
      duration: reduced ? 0.82 : 1.08,
      stagger: 0.11,
      ease: "power2.inOut",
    }, MEMORY_TO_THREAD.recessionStartsAt);
    timeline.to(finalMemory, {
      x: reduced ? 0 : targetX - centerX,
      y: reduced ? 0 : targetY - centerY,
      z: reduced ? 0 : 18,
      scale: reduced ? 1 : 1.025,
      duration: 0.94,
      ease: "sine.inOut",
    }, 0.28);
    timeline.to(environmentRef.current, {
      opacity: 0.22,
      filter: "saturate(0.48) brightness(0.42) contrast(1)",
      duration: 1.65,
      ease: "sine.inOut",
    }, 0.35);
    timeline.to(finalMemory, {
      filter: "saturate(0.62) brightness(0.76) contrast(0.9) blur(0.35px)",
      duration: 0.72,
      ease: "sine.inOut",
    }, MEMORY_TO_THREAD.holdEndsAt - 0.38);
    timeline.to(finalMemory, {
      "--memory-core": "0%",
      opacity: 0,
      filter: "saturate(0.5) brightness(0.58) contrast(0.82) blur(1.8px)",
      duration: MEMORY_TO_THREAD.dissolveEndsAt - MEMORY_TO_THREAD.holdEndsAt,
      ease: "sine.inOut",
    }, MEMORY_TO_THREAD.holdEndsAt);
    timeline.to(environmentRef.current, {
      opacity: 0.035,
      filter: "saturate(0.32) brightness(0.24) blur(2px)",
      duration: 1.5,
      ease: "sine.inOut",
    }, 2.05);
    timeline.to(rootRef.current, {
      filter: "brightness(0.58)",
      duration: MEMORY_TO_THREAD.handoffAt - 2.2,
      ease: "sine.inOut",
    }, 2.2);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [capabilities.motionMode, completeExit, phase, scopeId, visual]);

  return (
    <section
      ref={rootRef}
      className={styles.scene}
      data-testid="s03-scene"
      data-scene-phase={phase}
      data-collection-status={collectionStatus}
      aria-label="Shared Moments"
    >
      <div ref={environmentRef} className={styles.environment} aria-hidden="true">
        {environment ? <MediaImage asset={environment} alt="" className={styles.environmentImage} eager /> : null}
      </div>
      <div ref={streaksRef} className={styles.streaks} aria-hidden="true">
        {streaks ? <MediaImage asset={streaks} alt="" className={styles.streakImage} eager /> : null}
      </div>
      <div className={styles.memoryViewport}>
        <div ref={cameraRef} className={styles.cameraRig}>
          <div ref={memoryOneRef} className={`${styles.memory} ${styles.memoryOne}`} data-memory-id="together" data-final-memory="true">
            {together ? <MediaImage asset={together} alt="A shared private memory" objectFit="contain" sizes="(max-width: 720px) 55vw, 29vw" eager /> : null}
          </div>
          <div ref={memoryTwoRef} className={`${styles.memory} ${styles.memoryTwo}`} data-memory-id="minecraft-together">
            {minecraft ? <MediaImage asset={minecraft} alt="A shared game memory" objectFit="contain" sizes="(max-width: 720px) 76vw, 42vw" eager /> : null}
          </div>
          <div ref={memoryThreeRef} className={`${styles.memory} ${styles.memoryThree}`} data-memory-id="living-together">
            {living ? <MediaImage asset={living} alt="A shared conversation memory" objectFit="contain" sizes="(max-width: 720px) 80vw, 40vw" eager /> : null}
          </div>
        </div>
      </div>
      <p className={styles.phrase} aria-label={S03_COPY.full}>
        <span ref={phraseOneRef}>{S03_COPY.first}</span>
        <span ref={phraseTwoRef}>{S03_COPY.second}</span>
      </p>
    </section>
  );
}
