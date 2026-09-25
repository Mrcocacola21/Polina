"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";

import { useAudioEngine, useSceneAudio } from "@/lib/audio/AudioEngineContext";
import {
  createSingleExecutionLock,
  PHASE6_MUSIC_STATE,
  PROLOGUE_COPY,
  PROLOGUE_TIMING,
} from "@/lib/cinematic/phase6";
import { CROSSFADE_PRESETS, DUCK_PRESETS, FILM_MIX } from "@/lib/cinematic/directing";
import { useSceneRuntime } from "@/lib/cinematic/SceneRuntimeContext";
import { useMediaPreloadActions } from "@/lib/media/MediaPreloadContext";
import { useSoulCollectionRuntime } from "@/lib/souls/SoulCollectionContext";
import type { ParticleFieldController, SoulController } from "@/lib/visuals/VisualRuntime";
import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";
import { createSceneVisualScopeId } from "@/lib/visuals/VisualScope";

import styles from "./PrologueScene.module.css";

export function PrologueScene() {
  const rootRef = useRef<HTMLElement>(null);
  const lineOneRef = useRef<HTMLParagraphElement>(null);
  const lineTwoRef = useRef<HTMLParagraphElement>(null);
  const asideRef = useRef<HTMLParagraphElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const soulRef = useRef<SoulController | null>(null);
  const particlesRef = useRef<ParticleFieldController | null>(null);
  const coverPromiseRef = useRef<Promise<boolean> | null>(null);
  const lockRef = useRef(createSingleExecutionLock());
  const [opening, setOpening] = useState(false);
  const { phase, runId, completeEnter, completeExit, setCanAdvance, requestAdvance } =
    useSceneRuntime();
  const audio = useAudioEngine();
  const sceneAudio = useSceneAudio();
  const { startAfterOpenSoul } = useMediaPreloadActions();
  const visual = useVisualRuntime();
  const souls = useSoulCollectionRuntime();
  const scopeId = createSceneVisualScopeId("PROLOGUE", runId);

  useEffect(() => {
    souls.hideHud();
    visual.setCursorMode("HIDDEN");
    visual.setFog("NEUTRAL", 0.018, 0.8);
    visual.setGrain(0.018);
    visual.setVignette(0.54, 0.76);
    visual.setLightLeak(0);
    const soul = visual.createSoul({
      position: [0, -0.04, 0],
      scale: 0.82,
      state: "DORMANT",
      scopeId,
    });
    soul.startBreathing(0.015);
    const particles = visual.spawnParticleField({
      mode: "AMBIENT_DRIFT",
      count: 34,
      spread: [7, 4.5, 2],
      size: [0.016, 0.05],
      opacity: 0.14,
      velocity: 0.018,
      drift: 0.055,
      color: "#7f1c30",
      scopeId,
    });
    soulRef.current = soul;
    particlesRef.current = particles;
    return () => {
      soulRef.current = null;
      particlesRef.current = null;
      soul.dispose();
      particles.dispose();
    };
  }, [scopeId, souls, visual]);

  useEffect(() => {
    if (phase !== "entering" || !rootRef.current) return;
    const timeline = gsap.timeline({ onComplete: completeEnter });
    timeline.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: "power1.out" });
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [completeEnter, phase, scopeId, visual]);

  useEffect(() => {
    if (phase !== "active") return;
    const timeline = gsap.timeline();
    const reveal = (element: Element | null, at: number, duration = 1.05) => {
      if (!element) return;
      timeline.fromTo(
        element,
        { opacity: 0, filter: "blur(8px)", y: 10 },
        { opacity: 1, filter: "blur(0px)", y: 0, duration, ease: "power2.out" },
        at,
      );
    };
    reveal(lineOneRef.current, PROLOGUE_TIMING.firstLine);
    timeline.to(lineOneRef.current, {
      opacity: 0,
      filter: "blur(5px)",
      y: -5,
      duration: 0.8,
      ease: "power2.in",
    }, PROLOGUE_TIMING.firstLineOut);
    reveal(lineTwoRef.current, PROLOGUE_TIMING.secondLine);
    reveal(asideRef.current, PROLOGUE_TIMING.aside, 0.6);
    timeline.to(asideRef.current, {
      x: 1.5,
      textShadow: "-1px 0 rgb(124 14 34 / 45%), 1px 0 rgb(238 238 241 / 18%)",
      duration: 0.055,
      yoyo: true,
      repeat: 2,
      ease: "none",
    }, PROLOGUE_TIMING.aside + 0.62);
    timeline.to([lineTwoRef.current, asideRef.current], {
      opacity: 0,
      filter: "blur(5px)",
      y: -5,
      duration: 0.85,
      ease: "power2.in",
    }, PROLOGUE_TIMING.copyOut);
    timeline.call(() => {
      visual.setCursorMode("DEFAULT");
      setCanAdvance(true);
    }, [], PROLOGUE_TIMING.action - 0.12);
    reveal(actionRef.current, PROLOGUE_TIMING.action, 0.95);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [phase, scopeId, setCanAdvance, visual]);

  async function openSoul() {
    if (!lockRef.current()) return;
    setOpening(true);
    setCanAdvance(false);
    visual.setCursorMode("DEFAULT");
    particlesRef.current?.attract([0, 0, 0]);

    const unlock = audio.unlockAudio();
    void startAfterOpenSoul().catch((error: unknown) => {
      if (process.env.NODE_ENV === "development") {
        console.error("AFTER_OPEN_SOUL prefetch failed.", error);
      }
    });
    const unlockResult = await unlock;
    if (unlockResult.ok) {
      void audio.setMusicState(PHASE6_MUSIC_STATE, {
        crossfadeSeconds: CROSSFADE_PRESETS.noneToNight,
        gain: FILM_MIX.music.prologue,
      });
      void sceneAudio.playSfx("audio:prologue.soulAwakening", {
        gain: FILM_MIX.sfx.prologueAwakening,
        duckMusic: DUCK_PRESETS.prologueAwakening,
      });
    }

    visual.spawnParticleField({
      mode: "BURST",
      count: 72,
      position: [0, 0, 0],
      spread: [0.62, 0.62, 0.5],
      size: [0.02, 0.065],
      opacity: 0.42,
      velocity: 0.22,
      lifetime: 1.8,
      color: "#b82340",
      scopeId,
    });
    await soulRef.current?.awaken({ duration: PROLOGUE_TIMING.awaken, expansion: 1.1 });
    soulRef.current?.startBreathing(0.028);
    visual.setLightLeak(0.055, { scale: 1.1, position: [50, 48], drift: true });
    coverPromiseRef.current = visual.cover("SOUL_CIRCLE", PROLOGUE_TIMING.transition);
    setCanAdvance(true);
    requestAdvance();
  }

  useEffect(() => {
    if (phase !== "exiting") return;
    const timeline = gsap.timeline();
    timeline.to(rootRef.current, { opacity: 0.18, duration: 0.75, ease: "power2.in" });
    const finish = async () => {
      await (coverPromiseRef.current ?? visual.cover("SOUL_CIRCLE", PROLOGUE_TIMING.transition));
      completeExit();
    };
    void finish();
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [completeExit, phase, scopeId, visual]);

  function enterInteraction() {
    if (opening) return;
    visual.setCursorMode("INTERACTIVE");
    particlesRef.current?.attract([0, 0, 0]);
  }

  function leaveInteraction() {
    if (opening) return;
    visual.setCursorMode("DEFAULT");
    particlesRef.current?.update({ mode: "AMBIENT_DRIFT" });
  }

  return (
    <section
      ref={rootRef}
      className={styles.scene}
      data-testid="prologue-scene"
      data-scene-phase={phase}
      aria-label="Prologue"
    >
      <div className={styles.copy} aria-live="polite">
        <p ref={lineOneRef} className={styles.primary}>{PROLOGUE_COPY.lineOne}</p>
        <p ref={lineTwoRef} className={styles.primary}>{PROLOGUE_COPY.lineTwo}</p>
        <p ref={asideRef} className={styles.aside}>{PROLOGUE_COPY.aside}</p>
      </div>
      <button
        ref={actionRef}
        className={styles.openSoul}
        type="button"
        disabled={opening}
        aria-busy={opening}
        onClick={() => void openSoul()}
        onPointerEnter={enterInteraction}
        onPointerLeave={leaveInteraction}
        onFocus={enterInteraction}
        onBlur={leaveInteraction}
        data-testid="open-soul"
      >
        <span aria-hidden="true">[</span> {PROLOGUE_COPY.action} <span aria-hidden="true">]</span>
      </button>
    </section>
  );
}
