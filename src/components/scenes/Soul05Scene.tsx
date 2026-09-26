"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";

import { MediaImage } from "@/components/media/MediaImage";
import { useAudioEngine, useSceneAudio } from "@/lib/audio/AudioEngineContext";
import type { AmbientHandle } from "@/lib/audio/types";
import {
  createInteractionLock,
  PHASE7_MUSIC_STATE,
  phase7CollectionAllowsContinue,
  S05_COLLECTION,
  S05_COPY,
  S05_TIMING,
} from "@/lib/cinematic/phase7";
import { COLLECTION_SCENE_SCALE, DUCK_PRESETS, FILM_MIX } from "@/lib/cinematic/directing";
import { useSceneRuntime } from "@/lib/cinematic/SceneRuntimeContext";
import { useMediaAsset } from "@/lib/media/MediaPreloadContext";
import {
  useSceneSoulCollection,
  useSoulCollectionRuntime,
} from "@/lib/souls/SoulCollectionContext";
import type { ParticleFieldController } from "@/lib/visuals/VisualRuntime";
import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";
import { createSceneVisualScopeId } from "@/lib/visuals/VisualScope";

import styles from "./Soul05Scene.module.css";

function centerOf(element: HTMLElement | null): readonly [number, number] | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return [rect.left + rect.width / 2, rect.top + rect.height / 2];
}

export function Soul05Scene() {
  const rootRef = useRef<HTMLElement>(null);
  const roomRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLDivElement>(null);
  const screenshotRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLButtonElement>(null);
  const firstLineRef = useRef<HTMLSpanElement>(null);
  const secondLineRef = useRef<HTMLSpanElement>(null);
  const finalWordRef = useRef<HTMLElement>(null);
  const handoffRef = useRef<HTMLSpanElement>(null);
  const ambienceRef = useRef<AmbientHandle | null>(null);
  const particlesRef = useRef<ParticleFieldController | null>(null);
  const activationLockRef = useRef(createInteractionLock());
  const collectionStartedRef = useRef(false);
  const [activated, setActivated] = useState(false);
  const [collectionStatus, setCollectionStatus] = useState("pending");
  const { phase, runId, completeEnter, completeExit, setCanAdvance, setContinueVisible } =
    useSceneRuntime();
  const room = useMediaAsset("visual:sections.section05Asset01");
  const light = useMediaAsset("visual:sections.section05Asset02");
  const goodMorning = useMediaAsset("visual:screens.goodMorning");
  const audio = useAudioEngine();
  const sceneAudio = useSceneAudio();
  const { collect } = useSceneSoulCollection();
  const collectionRuntime = useSoulCollectionRuntime();
  const visual = useVisualRuntime();
  const scopeId = createSceneVisualScopeId("S05", runId);

  useEffect(() => {
    collectionRuntime.showHud();
    visual.setCursorMode("DEFAULT");
    visual.setFog("NEUTRAL", 0.035, 1.5);
    visual.setGrain(0.02);
    visual.setVignette(0.54, 0.76);
    visual.setLightLeak(0.012, {
      position: [18, 22],
      scale: 1.18,
      rotation: -18,
      drift: false,
    });
    const particles = visual.spawnParticleField({
      mode: "AMBIENT_DRIFT",
      count: 32,
      spread: [7.5, 4.7, 2.4],
      size: [0.01, 0.035],
      opacity: 0.08,
      velocity: 0.008,
      drift: 0.025,
      color: "#d8d3ca",
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
    audio.resetMusicTone(1.45);
    if (audio.getSnapshot().isUnlocked) {
      void audio.setMusicState(PHASE7_MUSIC_STATE, {
        crossfadeSeconds: 2.2,
        gain: FILM_MIX.music.s05,
        gainRampSeconds: 1.9,
      });
    }
    const reveal = visual.reveal("VERTICAL_SLIT", 1.25);
    const timeline = gsap.fromTo(
      rootRef.current,
      { opacity: 0, filter: "brightness(0.38)" },
      { opacity: 1, filter: "brightness(0.72)", duration: 1.25, ease: "power2.out" },
    );
    void Promise.all([
      reveal,
      new Promise<void>((resolve) => timeline.eventCallback("onComplete", resolve)),
    ]).then(() => completeEnter());
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [audio, completeEnter, phase, scopeId, visual]);

  useEffect(() => {
    if (phase !== "active" || !audio.getSnapshot().isUnlocked) return;
    void sceneAudio.playAmbient("MORNING_ROOM", {
      gain: FILM_MIX.ambient.s05Morning,
      fadeInSeconds: 2.2,
      loop: true,
    }).then((handle) => {
      ambienceRef.current = handle;
    });
  }, [audio, phase, sceneAudio]);

  function enterTarget() {
    if (activated) return;
    visual.setCursorMode("INTERACTIVE");
    particlesRef.current?.attract([-2.1, 0.65, 0]);
  }

  function leaveTarget() {
    if (activated) return;
    visual.setCursorMode("DEFAULT");
    particlesRef.current?.update({ mode: "AMBIENT_DRIFT", opacity: 0.08 });
  }

  function activateMorning() {
    if (!activationLockRef.current()) return;
    setActivated(true);
    visual.setCursorMode("DEFAULT");
    particlesRef.current?.update({
      mode: "AMBIENT_DRIFT",
      opacity: 0.16,
      velocity: 0.012,
      drift: 0.035,
    });
    visual.setFogOpacity(0.055, 2.1);
    visual.setLightLeak(0.026, { drift: true });
    if (audio.getSnapshot().isUnlocked) {
      void sceneAudio.playSfx("audio:scenes.s05.cue02", {
        gain: FILM_MIX.sfx.s05Reveal,
        duckMusic: DUCK_PRESETS.morningReveal,
      });
    }

    const playPiano = (ref: string, gain: number) => {
      if (!audio.getSnapshot().isUnlocked) return;
      void sceneAudio.playSfx(ref, { gain });
    };
    const timeline = gsap.timeline();
    timeline.to(roomRef.current, {
      filter: "brightness(0.86) saturate(0.82)",
      scale: 1.012,
      duration: 4.2,
      ease: "sine.inOut",
    }, 0);
    timeline.to(lightRef.current, {
      opacity: 0.42,
      duration: S05_TIMING.lightReveal,
      ease: "power2.out",
    }, 0);
    timeline.call(
      () => playPiano("audio:scenes.s05.cue03.a", FILM_MIX.sfx.s05PianoA),
      [],
      0.65,
    );
    timeline.fromTo(screenshotRef.current, {
      opacity: 0,
      filter: "blur(14px)",
      scale: 0.97,
    }, {
      opacity: 1,
      filter: "blur(0px)",
      scale: 1,
      duration: 2.2,
      ease: "power2.out",
    }, 1.15);
    timeline.call(
      () => playPiano("audio:scenes.s05.cue03.b", FILM_MIX.sfx.s05PianoB),
      [],
      S05_TIMING.screenshotReadable,
    );
    timeline.fromTo(firstLineRef.current, {
      opacity: 0,
      filter: "blur(8px)",
      y: 10,
    }, {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      duration: 1.15,
      ease: "power2.out",
    }, S05_TIMING.phraseOne);
    timeline.fromTo(secondLineRef.current, {
      opacity: 0,
      filter: "blur(8px)",
      y: 9,
    }, {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      duration: 1.15,
      ease: "power2.out",
    }, S05_TIMING.phraseTwo);
    timeline.call(() => {
      playPiano("audio:scenes.s05.cue03.c", FILM_MIX.sfx.s05PianoC);
      visual.setFogOpacity(0.065, 1.4);
      particlesRef.current?.update({ opacity: 0.2, drift: 0.045 });
    }, [], S05_TIMING.finalBeat);
    timeline.to(finalWordRef.current, {
      color: "rgb(255 245 229 / 100%)",
      textShadow: "0 0 16px rgb(239 226 197 / 25%)",
      duration: 1.1,
      ease: "sine.inOut",
    }, S05_TIMING.finalBeat);
    timeline.call(() => void runCollection(), [], S05_TIMING.collection);
    visual.addScopeCleanup(scopeId, () => timeline.kill());
  }

  async function runCollection() {
    if (collectionStartedRef.current) return;
    collectionStartedRef.current = true;
    const existing = collectionRuntime
      .getSnapshot()
      .slots.find((slot) => slot.soulId === S05_COLLECTION.soulId);
    if (existing?.status === "COLLECTED" || existing?.status === "RELEASED") {
      setCollectionStatus("already-collected");
      scheduleContinue();
      return;
    }
    const point = centerOf(screenshotRef.current);
    if (!point) return;
    setCollectionStatus("collecting");
    const result = await collect({
      source: { type: "POINT", point },
      variant: S05_COLLECTION.variant,
      visualState: S05_COLLECTION.visualState,
      timingScale: COLLECTION_SCENE_SCALE.S05,
    });
    setCollectionStatus(result.status);
    if (phase7CollectionAllowsContinue(result.status)) scheduleContinue();
    else if (process.env.NODE_ENV === "development") {
      console.warn("S05 remains gated because SOUL_05 did not commit.", result);
    }
  }

  function scheduleContinue() {
    const timer = window.setTimeout(() => {
      setCanAdvance(true);
      setContinueVisible(true);
    }, S05_TIMING.continueDelay * 1000);
    visual.addScopeCleanup(scopeId, () => window.clearTimeout(timer));
  }

  useEffect(() => {
    if (phase !== "exiting") return;
    ambienceRef.current?.stop({ fadeSeconds: 0.85 });
    ambienceRef.current = null;
    visual.setCursorMode("DEFAULT");
    visual.fadeFog(0.015, 0.8);
    visual.setLightLeak(0.01, { drift: false });
    const timeline = gsap.to(rootRef.current, {
      opacity: 0.08,
      filter: "brightness(0.42) saturate(0.65)",
      duration: 1.15,
      ease: "power2.inOut",
    });
    const handoff = gsap.timeline({ onComplete: completeExit });
    handoff.to(lightRef.current, { scale: 0.28, opacity: 0.18, transformOrigin: "42% 47%", duration: 0.9, ease: "power2.in" });
    handoff.fromTo(handoffRef.current, { opacity: 0, scale: 0.2 }, { opacity: 0.72, scale: 1.7, duration: 0.45, ease: "sine.out" }, 0.55);
    handoff.to(handoffRef.current, { opacity: 0.18, scale: 0.7, duration: 0.35, ease: "sine.in" });
    return visual.addScopeCleanup(scopeId, () => { timeline.kill(); handoff.kill(); });
  }, [completeExit, phase, scopeId, visual]);

  return (
    <section
      ref={rootRef}
      className={styles.scene}
      data-testid="s05-scene"
      data-scene-phase={phase}
      data-activated={activated}
      data-collection-status={collectionStatus}
      aria-label="Good Morning"
    >
      <div ref={roomRef} className={styles.room} aria-hidden="true">
        {room ? <MediaImage asset={room} alt="" className={styles.roomImage} eager /> : null}
      </div>
      <div ref={lightRef} className={styles.light} aria-hidden="true">
        {light ? <MediaImage asset={light} alt="" className={styles.lightImage} eager /> : null}
      </div>
      <span ref={handoffRef} className={styles.handoffPoint} aria-hidden="true" />
      <div ref={screenshotRef} className={styles.messageMemory}>
        {goodMorning ? (
          <MediaImage
            asset={goodMorning}
            alt="A good morning message"
            objectFit="contain"
            sizes="(max-width: 720px) 74vw, 32vw"
            eager
          />
        ) : null}
      </div>
      <button
        ref={targetRef}
        className={styles.lightTarget}
        type="button"
        disabled={activated}
        onClick={activateMorning}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          activateMorning();
        }}
        onPointerEnter={enterTarget}
        onPointerLeave={leaveTarget}
        onFocus={enterTarget}
        onBlur={leaveTarget}
        data-testid="morning-light-target"
        aria-label="Reveal the morning message"
      >
        <span aria-hidden="true" />
      </button>
      <p className={styles.phrase} aria-label={S05_COPY.full}>
        <span ref={firstLineRef}>{S05_COPY.first}</span>
        <span ref={secondLineRef}>
          {S05_COPY.secondLead}<em ref={finalWordRef}>{S05_COPY.finalWord}</em>
        </span>
      </p>
    </section>
  );
}
