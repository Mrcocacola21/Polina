"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";

import { MediaImage } from "@/components/media/MediaImage";
import { useAudioEngine, useSceneAudio } from "@/lib/audio/AudioEngineContext";
import type { MusicToneHandle } from "@/lib/audio/types";
import {
  PHASE7_MUSIC_STATE,
  phase7CollectionAllowsContinue,
  S04_COLLECTION,
  S04_COPY,
  S04_TIMING,
} from "@/lib/cinematic/phase7";
import { COLLECTION_SCENE_SCALE, FILM_MIX } from "@/lib/cinematic/directing";
import { MEMORY_TO_THREAD } from "@/lib/cinematic/memory-transition";
import { useSceneRuntime } from "@/lib/cinematic/SceneRuntimeContext";
import { useTransitionSnapshot } from "@/lib/cinematic/TransitionRuntimeContext";
import { useMediaAsset } from "@/lib/media/MediaPreloadContext";
import {
  useSceneSoulCollection,
  useSoulCollectionRuntime,
} from "@/lib/souls/SoulCollectionContext";
import type { ParticleFieldController } from "@/lib/visuals/VisualRuntime";
import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";
import { createSceneVisualScopeId } from "@/lib/visuals/VisualScope";

import styles from "./Soul04Scene.module.css";

function elementCenter(element: HTMLElement | null): readonly [number, number] | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return [rect.left + rect.width / 2, rect.top + rect.height / 2];
}

export function Soul04Scene() {
  const rootRef = useRef<HTMLElement>(null);
  const memoryOneRef = useRef<HTMLDivElement>(null);
  const memoryTwoRef = useRef<HTMLDivElement>(null);
  const memoryThreeRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<SVGPathElement>(null);
  const threadPointRef = useRef<HTMLSpanElement>(null);
  const phraseRef = useRef<HTMLParagraphElement>(null);
  const particlesRef = useRef<ParticleFieldController | null>(null);
  const toneRef = useRef<MusicToneHandle | null>(null);
  const collectionStartedRef = useRef(false);
  const [collectionStatus, setCollectionStatus] = useState("pending");
  const transition = useTransitionSnapshot();
  const [inheritedEntry] = useState(
    () => transition.definition?.id === "S03_S04" && transition.status !== "idle",
  );
  const { phase, runId, completeEnter, completeExit, setCanAdvance, setContinueVisible } =
    useSceneRuntime();
  const environment = useMediaAsset("visual:sections.section03Asset02");
  const together = useMediaAsset("visual:screens.together");
  const minecraft = useMediaAsset("visual:screens.minecraftTogether");
  const living = useMediaAsset("visual:screens.livingTogether");
  const audio = useAudioEngine();
  const sceneAudio = useSceneAudio();
  const { collect } = useSceneSoulCollection();
  const collectionRuntime = useSoulCollectionRuntime();
  const visual = useVisualRuntime();
  const scopeId = createSceneVisualScopeId("S04", runId);

  useEffect(() => {
    collectionRuntime.showHud();
    visual.setCursorMode("DEFAULT");
    visual.setFog("CRIMSON", inheritedEntry ? 0.008 : 0.045, 1.3);
    visual.setGrain(0.02);
    visual.setVignette(0.62, 0.78);
    visual.setLightLeak(0, { drift: false });
    const particles = visual.spawnParticleField({
      mode: "AMBIENT_DRIFT",
      count: inheritedEntry ? 12 : 24,
      spread: [8, 5, 3],
      size: [0.01, 0.032],
      opacity: inheritedEntry ? 0.025 : 0.09,
      velocity: 0.008,
      drift: 0.02,
      color: "#7d1528",
      scopeId,
    });
    particlesRef.current = particles;
    return () => {
      particlesRef.current = null;
      particles.dispose();
    };
  }, [collectionRuntime, inheritedEntry, scopeId, visual]);

  useEffect(() => {
    if (phase !== "entering") return;
    const timeline = inheritedEntry
      ? gsap.fromTo(
        rootRef.current,
        { opacity: 1, filter: "brightness(0.58)" },
        { opacity: 1, filter: "brightness(1)", duration: MEMORY_TO_THREAD.inheritedEntryDuration, ease: "sine.out" },
      )
      : gsap.fromTo(
        rootRef.current,
        { opacity: 0.72, filter: "brightness(0.72)" },
        { opacity: 1, filter: "brightness(1)", duration: 0.55, ease: "sine.out" },
      );
    timeline.eventCallback("onComplete", completeEnter);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [completeEnter, inheritedEntry, phase, scopeId, visual]);

  useEffect(() => {
    if (phase !== "active") return;
    if (audio.getSnapshot().isUnlocked) {
      void audio.setMusicState(PHASE7_MUSIC_STATE, {
        crossfadeSeconds: 2.2,
        gain: FILM_MIX.music.s04,
        gainRampSeconds: 1.8,
      });
      toneRef.current = sceneAudio.applyMusicTone({
        frequency: S04_TIMING.toneFrequency,
        presence: S04_TIMING.tonePresence,
        rampSeconds: S04_TIMING.toneRamp,
      });
    }

    const memories = [memoryOneRef.current, memoryTwoRef.current, memoryThreeRef.current];
    const timeline = gsap.timeline();
    if (!inheritedEntry) {
      memories.forEach((memory, index) => {
        timeline.to(memory, {
          z: -360 - index * 150,
          scale: 0.82 - index * 0.04,
          opacity: 0.1,
          filter: "saturate(0.34) blur(6px) brightness(0.55)",
          duration: 3.25,
          ease: "power2.inOut",
        }, [
          S04_TIMING.memoryOneRecede,
          S04_TIMING.memoryTwoRecede,
          S04_TIMING.memoryThreeRecede,
        ][index]);
      });
      timeline.fromTo(threadRef.current, {
        strokeDashoffset: 760,
        opacity: 0,
      }, {
        strokeDashoffset: 0,
        opacity: MEMORY_TO_THREAD.threadOpacity,
        duration: 2.8,
        ease: "sine.inOut",
      }, 2.05);
      timeline.fromTo(threadPointRef.current, {
        opacity: 0,
        scale: 0.3,
      }, {
        opacity: 0.82,
        scale: 1,
        duration: 1.1,
        ease: "sine.out",
      }, 3.35);
    }
    timeline.fromTo(phraseRef.current, {
      opacity: 0,
      filter: "blur(8px)",
      y: 8,
    }, {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      duration: 1.1,
      ease: "power2.out",
    }, inheritedEntry ? MEMORY_TO_THREAD.threadOnlyBeat : S04_TIMING.phrase);
    timeline.to(phraseRef.current, {
      opacity: 0,
      filter: "blur(4px)",
      duration: 0.8,
      ease: "power2.in",
    }, S04_TIMING.phraseOut);
    timeline.to(threadRef.current, {
      strokeDashoffset: -520,
      opacity: 0.18,
      duration: 1.2,
      ease: "power2.in",
    }, S04_TIMING.collection - 0.6);
    timeline.call(() => {
      particlesRef.current?.attract([0.45, 0.02, 0]);
      // GSAP invokes this after render; the declaration is stable for this keyed run.
      // eslint-disable-next-line react-hooks/immutability
      void runCollection();
    }, [], S04_TIMING.collection);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
    // This active scene run owns the thread collapse and its single collection attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, inheritedEntry]);

  async function runCollection() {
    if (collectionStartedRef.current) return;
    collectionStartedRef.current = true;
    const existing = collectionRuntime
      .getSnapshot()
      .slots.find((slot) => slot.soulId === S04_COLLECTION.soulId);
    if (existing?.status === "COLLECTED" || existing?.status === "RELEASED") {
      setCollectionStatus("already-collected");
      scheduleContinue();
      return;
    }
    const point = elementCenter(threadPointRef.current);
    if (!point) return;
    setCollectionStatus("collecting");
    const result = await collect({
      source: { type: "POINT", point },
      variant: S04_COLLECTION.variant,
      visualState: S04_COLLECTION.visualState,
      timingScale: COLLECTION_SCENE_SCALE.S04,
    });
    setCollectionStatus(result.status);
    if (phase7CollectionAllowsContinue(result.status)) scheduleContinue();
    else if (process.env.NODE_ENV === "development") {
      console.warn("S04 remains gated because SOUL_04 did not commit.", result);
    }
  }

  function scheduleContinue() {
    const timer = window.setTimeout(() => {
      setCanAdvance(true);
      setContinueVisible(true);
    }, S04_TIMING.continueDelay * 1000);
    visual.addScopeCleanup(scopeId, () => window.clearTimeout(timer));
  }

  useEffect(() => {
    if (phase !== "exiting") return;
    toneRef.current?.release(1.6);
    toneRef.current = null;
    visual.fadeFog(0, 0.9);
    const cover = visual.cover("VERTICAL_SLIT", 1.2);
    const timeline = gsap.timeline();
    timeline.to(threadPointRef.current, { opacity: 0, scale: 0.1, duration: 0.55 });
    timeline.to(rootRef.current, { opacity: 0.08, duration: 1.05, ease: "power2.in" }, 0.1);
    void cover.then(() => completeExit());
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [completeExit, phase, scopeId, visual]);

  return (
    <section
      ref={rootRef}
      className={styles.scene}
      data-testid="s04-scene"
      data-scene-phase={phase}
      data-collection-status={collectionStatus}
      data-inherited-thread={inheritedEntry ? "true" : "false"}
      aria-label="Miss You"
    >
      <div className={styles.environment} aria-hidden="true">
        {environment ? <MediaImage asset={environment} alt="" className={styles.environmentImage} eager /> : null}
      </div>
      <div className={styles.memoryWorld} aria-hidden="true">
        <div ref={memoryOneRef} className={`${styles.memory} ${styles.memoryOne}`}>
          {together ? <MediaImage asset={together} alt="" objectFit="contain" eager /> : null}
        </div>
        <div ref={memoryTwoRef} className={`${styles.memory} ${styles.memoryTwo}`}>
          {minecraft ? <MediaImage asset={minecraft} alt="" objectFit="contain" eager /> : null}
        </div>
        <div ref={memoryThreeRef} className={`${styles.memory} ${styles.memoryThree}`}>
          {living ? <MediaImage asset={living} alt="" objectFit="contain" eager /> : null}
        </div>
      </div>
      <svg className={styles.thread} viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
        <path
          ref={threadRef}
          d="M 520 274 C 556 356, 488 420, 510 520 C 488 420, 556 356, 520 274 S 440 136, 572 18"
          pathLength="760"
        />
      </svg>
      <span ref={threadPointRef} className={styles.threadPoint} aria-hidden="true" />
      <p ref={phraseRef} className={styles.phrase}>{S04_COPY.full}</p>
    </section>
  );
}
