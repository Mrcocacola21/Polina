"use client";

import gsap from "gsap";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MediaImage } from "@/components/media/MediaImage";
import { useAudioEngine, useSceneAudio } from "@/lib/audio/AudioEngineContext";
import type { MusicToneHandle, SfxHandle } from "@/lib/audio/types";
import {
  buildFinalQuestion,
  FINAL_ASSETS,
  FINAL_AUDIO,
  FINAL_QUESTION,
  FINAL_TAG,
  FINAL_TIMING,
} from "@/lib/cinematic/phase13";
import {
  AnswerController,
  ANSWER_LABELS,
  ANSWER_PERSISTENCE_KEY,
  ANSWER_TIMING,
  clearPersistedAnswer,
  parsePersistedAnswer,
  persistAnswer,
  THINK_TIMING,
  type AnswerResult,
  type AnswerSnapshot,
  YES_AUDIO,
  YES_TIMING,
  YES_VISUAL_LEVELS,
} from "@/lib/cinematic/phase14";
import { CROSSFADE_PRESETS, FILM_MIX } from "@/lib/cinematic/directing";
import { clearRecovery, createRecoveryRecord, persistRecovery, readRecovery } from "@/lib/cinematic/recovery";
import { useSceneRuntime } from "@/lib/cinematic/SceneRuntimeContext";
import { useMediaAsset } from "@/lib/media/MediaPreloadContext";
import { useSoulCollectionRuntime } from "@/lib/souls/SoulCollectionContext";
import type { ParticleFieldController, SoulController } from "@/lib/visuals/VisualRuntime";
import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";
import { createSceneVisualScopeId } from "@/lib/visuals/VisualScope";
import { SOUL_IDS } from "@/lib/souls/registry";

import styles from "./FinalScene.module.css";

const PARTICLES = Object.freeze([
  { x: "19%", y: "38%", delay: "-1.2s" },
  { x: "27%", y: "65%", delay: "-3.8s" },
  { x: "38%", y: "24%", delay: "-5.1s" },
  { x: "62%", y: "27%", delay: "-2.6s" },
  { x: "73%", y: "61%", delay: "-4.7s" },
  { x: "82%", y: "42%", delay: "-.5s" },
]);

type PersistenceStatus = "resolving" | "available" | "unavailable";
type Ending = "none" | "yes" | "think";

export function FinalScene() {
  const rootRef = useRef<HTMLElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const endingRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLFieldSetElement>(null);
  const yesButtonRef = useRef<HTMLButtonElement>(null);
  const thinkButtonRef = useRef<HTMLButtonElement>(null);
  const heartRef = useRef<HTMLDivElement>(null);
  const dormantRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const energyRef = useRef<HTMLDivElement>(null);
  const fullRef = useRef<HTMLDivElement>(null);
  const haloRef = useRef<HTMLDivElement>(null);
  const leftStreamRef = useRef<HTMLSpanElement>(null);
  const rightStreamRef = useRef<HTMLSpanElement>(null);
  const questionRef = useRef<HTMLParagraphElement>(null);
  const tagRef = useRef<HTMLParagraphElement>(null);
  const timelineStartedRef = useRef(false);
  const finalTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const branchTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const toneRef = useRef<MusicToneHandle | null>(null);
  const echoesRef = useRef<SoulController[]>([]);
  const releaseFieldRef = useRef<ParticleFieldController | null>(null);
  const yesSfxRef = useRef<SfxHandle[]>([]);
  const mountedRef = useRef(true);
  const [controller] = useState(() => new AnswerController());

  const [questionStep, setQuestionStep] = useState(0);
  const [beat, setBeat] = useState("black");
  const [persistenceStatus, setPersistenceStatus] = useState<PersistenceStatus>("resolving");
  const [persistedResult, setPersistedResult] = useState<AnswerResult | null>(null);
  const [answer, setAnswer] = useState<AnswerSnapshot>(() => controller.getSnapshot());
  const [answerVisible, setAnswerVisible] = useState(false);
  const [dateVisible, setDateVisible] = useState(false);
  const [ending, setEnding] = useState<Ending>("none");
  const [debugVisible, setDebugVisible] = useState(false);
  const [sandboxVisible, setSandboxVisible] = useState(false);
  const [activeBranchTimeline, setActiveBranchTimeline] = useState("none");
  const [soulEchoCount, setSoulEchoCount] = useState(0);
  const [endingParticleCount, setEndingParticleCount] = useState(0);
  const [yesCueFires, setYesCueFires] = useState(0);

  const { phase, runId, completeEnter } = useSceneRuntime();
  const audio = useAudioEngine();
  const sceneAudio = useSceneAudio();
  const collection = useSoulCollectionRuntime();
  const visual = useVisualRuntime();
  const scopeId = createSceneVisualScopeId("FINAL", runId);
  const dormant = useMediaAsset(FINAL_ASSETS.dormant);
  const core = useMediaAsset(FINAL_ASSETS.core);
  const energy = useMediaAsset(FINAL_ASSETS.energy);
  const full = useMediaAsset(FINAL_ASSETS.full);
  const halo = useMediaAsset(FINAL_ASSETS.halo);
  const question = useMemo(() => buildFinalQuestion(questionStep), [questionStep]);

  const disposeBranchVisuals = useCallback(() => {
    branchTimelineRef.current?.kill();
    branchTimelineRef.current = null;
    for (const soul of echoesRef.current) soul.dispose();
    echoesRef.current = [];
    releaseFieldRef.current?.dispose();
    releaseFieldRef.current = null;
    setSoulEchoCount(0);
    setEndingParticleCount(0);
    setActiveBranchTimeline("none");
  }, []);

  const focusEnding = useCallback(() => {
    endingRef.current?.focus({ preventScroll: true });
  }, []);

  const playYesCue = useCallback((ref: string, gain: number, transaction: number) => {
    if (controller.getSnapshot().transaction !== transaction) return;
    setYesCueFires((count) => count + 1);
    void sceneAudio.playSfx(ref, { gain, duckMusic: false }).then((handle) => {
      if (!handle || controller.getSnapshot().transaction !== transaction) {
        handle?.stop();
        return;
      }
      yesSfxRef.current.push(handle);
    });
  }, [controller, sceneAudio]);

  const applyStableComposition = useCallback((result: AnswerResult, startMusic: boolean) => {
    finalTimelineRef.current?.kill();
    disposeBranchVisuals();
    visual.leaveAbsoluteBlack();
    audio.leaveCinematicSilence();
    visual.setCursorMode("DIMMED");
    setQuestionStep(4);
    setAnswerVisible(false);
    setDateVisible(result === "YES");
    setEnding(result === "YES" ? "yes" : "think");
    setBeat(result === "YES" ? "yes-stable" : "think-stable");
    gsap.set([dormantRef.current, coreRef.current, energyRef.current], { opacity: result === "YES" ? 0.08 : 0.13 });
    gsap.set(fullRef.current, { opacity: result === "YES" ? 0.94 : 0.82, scale: 1 });
    gsap.set(haloRef.current, { opacity: result === "YES" ? 0.52 : 0.31, scale: result === "YES" ? 1.05 : 1 });
    gsap.set(questionRef.current, { opacity: result === "THINK" ? 0.9 : 0 });
    gsap.set(tagRef.current, { opacity: result === "THINK" ? 0.5 : 0 });
    gsap.set(cameraRef.current, { scale: result === "YES" ? YES_VISUAL_LEVELS.yesCameraScale : 1 });
    toneRef.current?.release(1.2);
    toneRef.current = null;
    if (startMusic && audio.getSnapshot().isUnlocked) {
      const currentMusic = audio.getSnapshot().music.state;
      void audio.crossfadeMusic(FINAL_AUDIO.musicState, {
        crossfadeSeconds: result === "YES"
          ? CROSSFADE_PRESETS.heartAndSoulYesExpansion
          : CROSSFADE_PRESETS.heartAndSoulThinkSettle,
        gain: result === "YES" ? FILM_MIX.music.yes : FILM_MIX.music.think,
        restart: currentMusic !== FINAL_AUDIO.musicState,
        loop: true,
      });
    }
  }, [audio, disposeBranchVisuals, visual]);

  const startYesBranch = useCallback((transaction: number) => {
    const reducedMotion = visual.motionIntensity < 0.5;
    const isCurrent = () => mountedRef.current && controller.getSnapshot().transaction === transaction;
    setActiveBranchTimeline("YES");
    setEnding("none");
    setDateVisible(false);
    setBeat("yes-committing");
    const timeline = gsap.timeline();
    branchTimelineRef.current = timeline;

    timeline.to(controlsRef.current, { opacity: 0, y: reducedMotion ? 0 : 5, duration: 0.52, ease: "sine.out" }, YES_TIMING.stillness);
    timeline.call(() => {
      if (!isCurrent()) return;
      setAnswerVisible(false);
      focusEnding();
    }, [], YES_TIMING.stillness + 0.52);
    timeline.to(heartRef.current, {
      scale: reducedMotion ? 1.012 : YES_VISUAL_LEVELS.yesHeartScale,
      duration: 0.54,
      ease: "sine.inOut",
      repeat: 1,
      yoyo: true,
    }, YES_TIMING.heartPulse);
    timeline.to(fullRef.current, { opacity: 0.97, duration: 1.2, ease: "sine.out" }, YES_TIMING.heartPulse);
    timeline.to(haloRef.current, { opacity: 0.72, scale: reducedMotion ? 1.045 : 1.11, duration: 1.35, ease: "sine.out" }, YES_TIMING.heartPulse);

    timeline.call(() => {
      if (!isCurrent()) return;
      const centerX = window.innerWidth * 0.5;
      const centerY = window.innerHeight * 0.43;
      const radius = Math.min(window.innerWidth, window.innerHeight) * (reducedMotion ? 0.065 : 0.085);
      const echoes = Array.from({ length: YES_VISUAL_LEVELS.soulEchoCount }, (_, index) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / YES_VISUAL_LEVELS.soulEchoCount;
        const position = visual.screenToWorld(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius, 0.08)
          ?? [Math.cos(angle) * 1.1, Math.sin(angle) * 1.1, 0.08] as const;
        const soul = visual.createSoul({ position, scale: reducedMotion ? 0.13 : 0.17, state: "ACTIVE", scopeId });
        soul.startBreathing(0.018);
        void soul.spawn({ duration: reducedMotion ? 0.28 : 0.46, position, scale: reducedMotion ? 0.13 : 0.17 });
        return soul;
      });
      echoesRef.current = echoes;
      setSoulEchoCount(echoes.length);
    }, [], YES_TIMING.soulEchoes);

    timeline.call(() => {
      if (!isCurrent()) return;
      playYesCue(YES_AUDIO.soulRelease, FILM_MIX.sfx.yesRelease, transaction);
      void audio.setMusicState(FINAL_AUDIO.musicState, {
        gain: FILM_MIX.music.yes,
        gainRampSeconds: CROSSFADE_PRESETS.heartAndSoulYesExpansion,
      });
      releaseFieldRef.current = visual.spawnParticleField({
        mode: "BURST",
        count: reducedMotion ? 300 : YES_VISUAL_LEVELS.releaseParticleCount,
        position: [0, 0.55, 0],
        spread: [1.1, 1.1, 1.8],
        size: [0.009, 0.048],
        opacity: reducedMotion ? 0.42 : 0.68,
        velocity: reducedMotion ? 0.16 : 0.38,
        drift: 0.22,
        lifetime: YES_VISUAL_LEVELS.releaseLifetime,
        fade: 2.5,
        color: "#ef6a78",
        depthRange: [-4.4, 4.4],
        scopeId,
      });
      setEndingParticleCount(visual.particleFields.get(releaseFieldRef.current.id)?.count ?? 0);
      toneRef.current?.release(YES_TIMING.musicOpenDuration);
      toneRef.current = null;
      echoesRef.current.forEach((soul, index) => {
        const angle = -Math.PI / 2 + (Math.PI * 2 * index) / YES_VISUAL_LEVELS.soulEchoCount;
        const target = visual.screenToWorld(
          window.innerWidth * 0.5 + Math.cos(angle) * Math.min(window.innerWidth, window.innerHeight) * 0.14,
          window.innerHeight * 0.43 + Math.sin(angle) * Math.min(window.innerWidth, window.innerHeight) * 0.14,
          0.05,
        ) ?? [Math.cos(angle) * 2, Math.sin(angle) * 2, 0.05] as const;
        void soul.flyTo(target, { duration: reducedMotion ? 0.42 : 0.92, curve: reducedMotion ? 0 : 0.12, trail: !reducedMotion, scale: 0.11 })
          .then(() => soul.fadeOut({ duration: reducedMotion ? 0.25 : 0.62, expansion: 1.08 }))
          .then(() => {
            soul.dispose();
            if (isCurrent()) setSoulEchoCount((count) => Math.max(0, count - 1));
          });
      });
    }, [], YES_TIMING.release);
    timeline.to(cameraRef.current, { scale: reducedMotion ? 0.992 : YES_VISUAL_LEVELS.yesCameraScale, duration: 3.2, ease: "sine.inOut" }, YES_TIMING.release);
    timeline.to(haloRef.current, { opacity: 0.5, scale: 1.05, duration: 3.1, ease: "sine.inOut" }, YES_TIMING.release + 1.1);
    timeline.to([questionRef.current, tagRef.current], { opacity: 0, duration: 1.8, ease: "sine.out" }, YES_TIMING.releaseSettle - 0.8);
    timeline.call(() => {
      if (!isCurrent()) return;
      playYesCue(YES_AUDIO.finalResolve, FILM_MIX.sfx.yesResolve, transaction);
      setBeat("yes-resolve");
    }, [], YES_TIMING.resolve);
    timeline.call(() => {
      if (!isCurrent()) return;
      setDateVisible(true);
      setEnding("yes");
    }, [], YES_TIMING.dateReveal);
    timeline.fromTo(endingRef.current, { opacity: 0 }, { opacity: 1, duration: 1.5, ease: "sine.out" }, YES_TIMING.dateReveal);
    timeline.call(() => {
      if (!isCurrent()) return;
      releaseFieldRef.current?.dispose();
      releaseFieldRef.current = null;
      echoesRef.current.forEach((soul) => soul.dispose());
      echoesRef.current = [];
      setSoulEchoCount(0);
      setEndingParticleCount(0);
      setBeat("yes-stable");
      setActiveBranchTimeline("none");
      setAnswer(controller.stabilize(transaction));
      branchTimelineRef.current = null;
    }, [], YES_TIMING.stable);
  }, [audio, controller, focusEnding, playYesCue, scopeId, visual]);

  const startThinkBranch = useCallback((transaction: number) => {
    const isCurrent = () => mountedRef.current && controller.getSnapshot().transaction === transaction;
    setActiveBranchTimeline("THINK");
    setEnding("none");
    setBeat("think-committing");
    const timeline = gsap.timeline();
    branchTimelineRef.current = timeline;
    timeline.to(controlsRef.current, { opacity: 0, y: visual.motionIntensity < 0.5 ? 0 : 4, duration: 0.54, ease: "sine.out" }, THINK_TIMING.stillness);
    timeline.call(() => {
      if (!isCurrent()) return;
      setAnswerVisible(false);
      focusEnding();
    }, [], THINK_TIMING.controlsGone);
    timeline.to(haloRef.current, { opacity: 0.31, scale: 1, duration: 1.25, ease: "sine.inOut" }, THINK_TIMING.stillness);
    timeline.to(fullRef.current, { opacity: 0.82, duration: 1.25, ease: "sine.inOut" }, THINK_TIMING.stillness);
    timeline.to(questionRef.current, { opacity: 0.9, duration: 1.1, ease: "sine.inOut" }, THINK_TIMING.calm);
    timeline.to(tagRef.current, { opacity: 0.5, duration: 1.1, ease: "sine.inOut" }, THINK_TIMING.calm);
    timeline.call(() => {
      if (!isCurrent()) return;
      toneRef.current?.release(1.2);
      toneRef.current = null;
      void audio.setMusicState(FINAL_AUDIO.musicState, {
        gain: FILM_MIX.music.think,
        gainRampSeconds: CROSSFADE_PRESETS.heartAndSoulThinkSettle,
      });
    }, [], THINK_TIMING.calm);
    timeline.call(() => {
      if (!isCurrent()) return;
      setEnding("think");
      setBeat("think-stable");
      setActiveBranchTimeline("none");
      setAnswer(controller.stabilize(transaction));
      branchTimelineRef.current = null;
    }, [], THINK_TIMING.stable);
  }, [audio, controller, focusEnding, visual.motionIntensity]);

  const commitAnswer = useCallback((result: AnswerResult) => {
    const committed = controller.commit(result);
    if (!committed.accepted || !committed.record) return;
    yesButtonRef.current?.setAttribute("disabled", "");
    thinkButtonRef.current?.setAttribute("disabled", "");
    setAnswer(committed.snapshot);
    visual.setCursorMode("DIMMED");
    try {
      if (process.env.NODE_ENV === "development" && new URLSearchParams(window.location.search).get("answerStorageFailure") === "1") {
        throw new Error("Simulated answer storage failure");
      }
      const stored = persistAnswer(window.localStorage, committed.record);
      setPersistenceStatus(stored ? "available" : "unavailable");
      setPersistedResult(stored ? result : null);
      if (stored) clearRecovery(window.sessionStorage);
    } catch {
      setPersistenceStatus("unavailable");
    }
    if (result === "YES") startYesBranch(committed.snapshot.transaction);
    else startThinkBranch(committed.snapshot.transaction);
  }, [controller, startThinkBranch, startYesBranch, visual]);

  const resetAnswer = useCallback(() => {
    finalTimelineRef.current?.kill();
    disposeBranchVisuals();
    yesSfxRef.current.forEach((handle) => handle.stop({ fadeSeconds: 0.05 }));
    yesSfxRef.current = [];
    toneRef.current?.release(0.2);
    toneRef.current = null;
    const cleared = clearPersistedAnswer(window.localStorage);
    setPersistenceStatus(cleared ? "available" : "unavailable");
    setPersistedResult(null);
    setAnswer(controller.reset());
    setQuestionStep(4);
    setEnding("none");
    setDateVisible(false);
    setAnswerVisible(true);
    setBeat("stable");
    setYesCueFires(0);
    visual.leaveAbsoluteBlack();
    audio.leaveCinematicSilence();
    visual.setCursorMode("DEFAULT");
    gsap.set([dormantRef.current, coreRef.current, energyRef.current], { opacity: 0.14 });
    gsap.set(fullRef.current, { opacity: 0.88, scale: 1 });
    gsap.set(haloRef.current, { opacity: 0.48, scale: 1.035 });
    gsap.set(questionRef.current, { opacity: 1, filter: "blur(0px)", y: 0 });
    gsap.set(tagRef.current, { opacity: 0.66, filter: "blur(0px)", y: 0 });
    gsap.set(cameraRef.current, { scale: 1 });
    toneRef.current = sceneAudio.applyMusicTone({ ...FILM_MIX.finalTone, rampSeconds: 0.8 });
  }, [audio, controller, disposeBranchVisuals, sceneAudio, visual]);

  const restartStory = useCallback(() => {
    const answerCleared = clearPersistedAnswer(window.localStorage);
    const recoveryCleared = clearRecovery(window.sessionStorage);
    if (!answerCleared || !recoveryCleared) {
      setPersistenceStatus("unavailable");
      return;
    }
    window.location.reload();
  }, []);

  const forceStable = useCallback((result: AnswerResult) => {
    controller.reset();
    const transaction = controller.commit(result, new Date()).snapshot.transaction;
    setAnswer(controller.stabilize(transaction));
    applyStableComposition(result, true);
  }, [applyStableComposition, controller]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const debug = process.env.NODE_ENV === "development" && params.get("debug") === "1";
    const timer = window.setTimeout(() => {
      setDebugVisible(debug);
      setSandboxVisible(debug && params.get("answerSandbox") === "1");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    visual.enterAbsoluteBlack();
    audio.enterCinematicSilence();
    audio.stopMusic({ fadeSeconds: 0 });
    audio.stopAllAmbient({ fadeSeconds: 0 });
    audio.stopAllSfx();
    audio.stopAllProcedural();
    collection.hideHud();
    collection.disposeReleasedSouls();
    visual.setFog(null, 0, 0);
    visual.setGrain(0);
    visual.setVignette(0, 1);
    visual.setLightLeak(0, { drift: false });
    visual.setCursorMode("HIDDEN");
    return () => {
      mountedRef.current = false;
      finalTimelineRef.current?.kill();
      disposeBranchVisuals();
      toneRef.current?.release(0.05);
      yesSfxRef.current.forEach((handle) => handle.stop({ fadeSeconds: 0 }));
      yesSfxRef.current = [];
      audio.stopMusic({ fadeSeconds: 0 });
      audio.stopAllSfx();
    };
  }, [audio, collection, disposeBranchVisuals, visual]);

  useEffect(() => {
    if (phase !== "entering") return;
    let cancelled = false;
    let fallbackTimer = 0;
    void (async () => {
      let restored: AnswerResult | null = null;
      try {
        const params = new URLSearchParams(window.location.search);
        if (process.env.NODE_ENV === "development" && params.get("answerStorageFailure") === "1") throw new Error("Simulated answer storage failure");
        const parsed = parsePersistedAnswer(window.localStorage.getItem(ANSWER_PERSISTENCE_KEY));
        setPersistenceStatus("available");
        if (parsed) {
          restored = parsed.result;
          setPersistedResult(parsed.result);
          setAnswer(controller.hydrate(parsed));
        }
      } catch {
        setPersistenceStatus("unavailable");
      }
      if (!restored) {
        try {
          const catalog = await audio.getCatalog();
          const ids = [FINAL_AUDIO.awakening, FINAL_AUDIO.merge, FINAL_AUDIO.halo, YES_AUDIO.soulRelease, YES_AUDIO.finalResolve]
            .map((ref) => catalog.getBySemanticRef(ref).id);
          await Promise.race([
            audio.prepareSfx(ids),
            new Promise<number>((resolve) => { fallbackTimer = window.setTimeout(() => resolve(0), 1600); }),
          ]);
        } catch (error) {
          if (process.env.NODE_ENV === "development") console.warn("Final audio preparation degraded; visual sequence will continue.", error);
        }
      }
      if (!cancelled) completeEnter();
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimer);
    };
  }, [audio, completeEnter, controller, phase]);

  useEffect(() => {
    if (phase !== "active" || timelineStartedRef.current || persistenceStatus === "resolving") return;
    timelineStartedRef.current = true;
    const restored = controller.getSnapshot();
    if (restored.state === "YES" || restored.state === "THINK") {
      clearRecovery(window.sessionStorage);
      const deferred = gsap.delayedCall(0, () => applyStableComposition(restored.state as AnswerResult, true));
      return () => {
        deferred.kill();
      };
    }
    const recovery = readRecovery(window.sessionStorage);
    if (recovery?.sceneId === "FINAL" && recovery.checkpoint === "FINAL_QUESTION") {
      const deferred = gsap.delayedCall(0, () => {
        visual.leaveAbsoluteBlack();
        audio.leaveCinematicSilence();
        visual.setCursorMode("DEFAULT");
        setQuestionStep(4);
        setBeat("stable");
        setAnswerVisible(true);
        gsap.set([dormantRef.current, coreRef.current, energyRef.current], { opacity: 0.14 });
        gsap.set(fullRef.current, { opacity: 0.88, scale: 1 });
        gsap.set(haloRef.current, { opacity: 0.48, scale: 1.035 });
        gsap.set(questionRef.current, { opacity: 1, filter: "blur(0px)", y: 0 });
        gsap.set(tagRef.current, { opacity: 0.66, filter: "blur(0px)", y: 0 });
      });
      return () => deferred.kill();
    }
    const reducedMotion = visual.motionIntensity < 0.5;
    const streamDistance = () => (rootRef.current?.clientWidth ?? window.innerWidth) * 0.35;
    const layers = [dormantRef.current, coreRef.current, energyRef.current, fullRef.current, haloRef.current]
      .filter((element): element is HTMLDivElement => element !== null);
    gsap.set(layers, { opacity: 0 });
    gsap.set(questionRef.current, { opacity: 0, filter: "blur(3px)", y: 4 });
    gsap.set(tagRef.current, { opacity: 0, filter: "blur(2px)", y: 3 });
    gsap.set([leftStreamRef.current, rightStreamRef.current], { opacity: 0, x: 0, y: 0 });
    const timeline = gsap.timeline();
    finalTimelineRef.current = timeline;
    timeline.call(() => {
      setBeat("awakening");
      visual.leaveAbsoluteBlack();
      audio.leaveCinematicSilence();
      visual.setCursorMode("DIMMED");
      void sceneAudio.playSfx(FINAL_AUDIO.awakening, { gain: FILM_MIX.sfx.finalAwakening, duckMusic: false });
    }, [], FINAL_TIMING.awakening);
    timeline.fromTo(dormantRef.current, { opacity: 0, scale: reducedMotion ? 0.994 : 0.975 }, { opacity: 0.74, scale: 1, duration: 1.75, ease: "sine.out" }, FINAL_TIMING.awakening);
    timeline.call(() => setQuestionStep(1), [], FINAL_TIMING.firstWords);
    timeline.to(questionRef.current, { opacity: 1, filter: "blur(0px)", y: 0, duration: 0.9, ease: "sine.out" }, FINAL_TIMING.firstWords);
    timeline.call(() => {
      setBeat("core");
      void audio.crossfadeMusic(FINAL_AUDIO.musicState, {
        crossfadeSeconds: FINAL_TIMING.musicFadeIn,
        gain: FILM_MIX.music.finalPreAnswer,
        restart: true,
        loop: true,
      });
      toneRef.current = sceneAudio.applyMusicTone({ ...FILM_MIX.finalTone, rampSeconds: FINAL_TIMING.musicFadeIn });
    }, [], FINAL_TIMING.core);
    timeline.to(dormantRef.current, { opacity: 0.18, duration: 2.1, ease: "sine.inOut" }, FINAL_TIMING.core);
    timeline.fromTo(coreRef.current, { opacity: 0, scale: reducedMotion ? 0.997 : 0.988 }, { opacity: 0.82, scale: 1, duration: 2.05, ease: "sine.inOut" }, FINAL_TIMING.core);
    timeline.call(() => setQuestionStep(2), [], FINAL_TIMING.secondWords);
    timeline.fromTo(questionRef.current, { opacity: 0.58, filter: "blur(1.5px)", y: 3 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 0.72, ease: "sine.out" }, FINAL_TIMING.secondWords);
    timeline.call(() => {
      setBeat("merge");
      void sceneAudio.playSfx(FINAL_AUDIO.merge, { gain: FILM_MIX.sfx.finalMerge, duckMusic: false });
    }, [], FINAL_TIMING.merge);
    timeline.fromTo(energyRef.current, { opacity: 0, scale: reducedMotion ? 0.998 : 0.992 }, { opacity: 0.62, scale: 1, duration: 1.55, ease: "sine.out" }, FINAL_TIMING.merge);
    timeline.fromTo(leftStreamRef.current, { opacity: 0, x: () => reducedMotion ? streamDistance() * 0.78 : 0, y: reducedMotion ? 0 : -8 }, { opacity: reducedMotion ? 0.54 : 0.86, x: streamDistance, y: reducedMotion ? 0 : 5, duration: FINAL_TIMING.mergeConvergenceOffset, ease: "power2.inOut" }, FINAL_TIMING.merge);
    timeline.fromTo(rightStreamRef.current, { opacity: 0, x: () => reducedMotion ? -streamDistance() * 0.78 : 0, y: reducedMotion ? 0 : 9 }, { opacity: reducedMotion ? 0.54 : 0.86, x: () => -streamDistance(), y: reducedMotion ? 0 : -4, duration: FINAL_TIMING.mergeConvergenceOffset, ease: "power2.inOut" }, FINAL_TIMING.merge);
    timeline.call(() => setQuestionStep(3), [], FINAL_TIMING.mergeWord);
    timeline.fromTo(questionRef.current, { opacity: 0.62, filter: "blur(1.2px)", y: 2 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 0.68, ease: "sine.out" }, FINAL_TIMING.mergeWord);
    timeline.to(heartRef.current, { scale: reducedMotion ? 1.003 : 1.012, duration: 0.38, ease: "sine.out", yoyo: true, repeat: 1 }, FINAL_TIMING.merge + FINAL_TIMING.mergeConvergenceOffset);
    timeline.to([leftStreamRef.current, rightStreamRef.current], { opacity: 0, duration: 0.62, ease: "sine.out" }, FINAL_TIMING.merge + FINAL_TIMING.mergeConvergenceOffset);
    timeline.call(() => {
      setBeat("full");
      setQuestionStep(4);
      void sceneAudio.playSfx(FINAL_AUDIO.halo, { gain: FILM_MIX.sfx.finalHalo, duckMusic: false });
    }, [], FINAL_TIMING.full);
    timeline.to([coreRef.current, energyRef.current], { opacity: 0.14, duration: 2.2, ease: "sine.inOut" }, FINAL_TIMING.full);
    timeline.fromTo(fullRef.current, { opacity: 0, scale: reducedMotion ? 0.998 : 0.992 }, { opacity: 0.88, scale: 1, duration: 2.15, ease: "sine.inOut" }, FINAL_TIMING.full);
    timeline.fromTo(haloRef.current, { opacity: 0, scale: 0.94 }, { opacity: 0.48, scale: 1.035, duration: 2.65, ease: "sine.out" }, FINAL_TIMING.full);
    timeline.fromTo(questionRef.current, { opacity: 0.66, filter: "blur(1.2px)", y: 2 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 0.82, ease: "sine.out" }, FINAL_TIMING.full);
    timeline.call(() => setBeat("tag"), [], FINAL_TIMING.tag);
    timeline.to(tagRef.current, { opacity: 0.66, filter: "blur(0px)", y: 0, duration: 0.82, ease: "sine.out" }, FINAL_TIMING.tag);
    timeline.call(() => setBeat("stable"), [], FINAL_TIMING.stable);
    timeline.call(() => {
      setAnswerVisible(true);
      visual.setCursorMode("DEFAULT");
      persistRecovery(
        window.sessionStorage,
        createRecoveryRecord("FINAL", SOUL_IDS, new Date(), "FINAL_QUESTION"),
      );
    }, [], FINAL_TIMING.stable + ANSWER_TIMING.revealDelayAfterFinalStable);
    return () => {
      timeline.kill();
    };
  }, [applyStableComposition, audio, controller, persistenceStatus, phase, sceneAudio, visual]);

  const audioSnapshot = audio.getSnapshot();
  const activeYesSfx = audioSnapshot.activeSfxCount;

  return (
    <section
      ref={rootRef}
      className={styles.scene}
      data-testid="final-scene"
      data-scene-beat={beat}
      data-question-step={questionStep}
      data-answer-state={answer.state}
      data-answer-locked={answer.locked}
      data-answer-visible={answerVisible}
      data-ending={ending}
      data-persistence={persistenceStatus}
      data-soul-echoes={soulEchoCount}
      data-ending-particles={endingParticleCount}
      data-yes-cue-fires={yesCueFires}
      data-terminal={beat === "stable" || beat.endsWith("-stable") ? "true" : "false"}
      data-merge-streams-active={beat === "merge" ? "true" : "false"}
      aria-label="Final Confession"
    >
      <div ref={cameraRef} className={styles.camera}>
        <div ref={heartRef} className={styles.heartComposition} aria-hidden="true">
          <div ref={haloRef} className={`${styles.heartLayer} ${styles.haloLayer}`}>
            {halo ? <MediaImage asset={halo} alt="" objectFit="contain" eager /> : null}
            <span className={styles.haloFallback} />
          </div>
          <div ref={dormantRef} className={`${styles.heartLayer} ${styles.dormantLayer}`}>
            {dormant ? <MediaImage asset={dormant} alt="" objectFit="contain" eager /> : null}
            <span className={styles.heartFallback} />
          </div>
          <div ref={coreRef} className={`${styles.heartLayer} ${styles.coreLayer}`}>
            {core ? <MediaImage asset={core} alt="" objectFit="contain" eager /> : null}
            <span className={styles.heartFallback} />
          </div>
          <div ref={energyRef} className={`${styles.heartLayer} ${styles.energyLayer}`}>
            {energy ? <MediaImage asset={energy} alt="" objectFit="contain" eager /> : null}
          </div>
          <div ref={fullRef} className={`${styles.heartLayer} ${styles.fullLayer}`}>
            {full ? <MediaImage asset={full} alt="" objectFit="contain" eager /> : null}
            <span className={styles.heartFallback} />
          </div>
          <div className={styles.microParticles}>
            {PARTICLES.map((particle) => <span key={`${particle.x}-${particle.y}`} style={{ left: particle.x, top: particle.y, animationDelay: particle.delay }} />)}
          </div>
        </div>
        <div className={styles.mergeStreams} aria-hidden="true">
          <span ref={leftStreamRef} className={`${styles.mergeStream} ${styles.leftStream}`} />
          <span ref={rightStreamRef} className={`${styles.mergeStream} ${styles.rightStream}`} />
        </div>
        <div className={styles.copy}>
          <p id="final-question" ref={questionRef} className={styles.question} aria-label={questionStep === 4 ? FINAL_QUESTION : undefined}>{question}</p>
          <p ref={tagRef} className={styles.tag}>{FINAL_TAG}</p>
        </div>
      </div>

      {answerVisible && (answer.state === "UNANSWERED" || answer.state.startsWith("COMMITTING_")) ? (
        <fieldset ref={controlsRef} className={styles.answerControls} aria-labelledby="final-question" disabled={answer.locked}>
          <button ref={yesButtonRef} className={`${styles.answerButton} ${styles.yesButton}`} type="button" onClick={() => commitAnswer("YES")} onPointerEnter={() => visual.setCursorMode("INTERACTIVE")} onPointerLeave={() => visual.setCursorMode(answer.locked ? "DIMMED" : "DEFAULT")} onFocus={() => visual.setCursorMode("INTERACTIVE")} onBlur={() => visual.setCursorMode(answer.locked ? "DIMMED" : "DEFAULT")}>{ANSWER_LABELS.YES}</button>
          <button ref={thinkButtonRef} className={`${styles.answerButton} ${styles.thinkButton}`} type="button" onClick={() => commitAnswer("THINK")} onPointerEnter={() => visual.setCursorMode("INTERACTIVE")} onPointerLeave={() => visual.setCursorMode(answer.locked ? "DIMMED" : "DEFAULT")} onFocus={() => visual.setCursorMode("INTERACTIVE")} onBlur={() => visual.setCursorMode(answer.locked ? "DIMMED" : "DEFAULT")}>{ANSWER_LABELS.THINK}</button>
        </fieldset>
      ) : null}

      <div ref={endingRef} className={styles.ending} tabIndex={-1} aria-label={ending === "yes" ? `Ответ сохранён. ${answer.finalDateDisplay ?? ""}` : ending === "think" ? "Ответ сохранён." : undefined}>
        {dateVisible && answer.finalDateDisplay ? <time dateTime={answer.answeredAt ?? undefined} className={styles.finalDate} data-testid="final-answer-date">{answer.finalDateDisplay}</time> : null}
        {ending !== "none" ? (
          <button
            className={styles.restartButton}
            data-testid="restart-story"
            type="button"
            onClick={restartStory}
            onPointerEnter={() => visual.setCursorMode("INTERACTIVE")}
            onPointerLeave={() => visual.setCursorMode("DIMMED")}
            onFocus={() => visual.setCursorMode("INTERACTIVE")}
            onBlur={() => visual.setCursorMode("DIMMED")}
          >
            Пройти заново
          </button>
        ) : null}
      </div>

      {debugVisible ? (
        <aside className={styles.answerDebug} data-testid="answer-debug-panel">
          <strong>ANSWER</strong>
          <span>Answer: {answer.state}</span><span>Locked: {String(answer.locked)}</span>
          <span>Persistence: {persistenceStatus}</span><span>Persisted: {persistedResult ?? "none"}</span>
          <span>answeredAt: {answer.answeredAt ?? "—"}</span><span>Timeline: {activeBranchTimeline}</span>
          <span>Soul echoes: {soulEchoCount}</span><span>YES particles: {endingParticleCount}</span>
          <span>Current ending: {ending}</span><span>MUS-04 branch gain: {audioSnapshot.music.gain.toFixed(2)}</span>
          <span>Active YES SFX: {activeYesSfx}</span>
          {sandboxVisible ? <div className={styles.answerDebugControls}><button type="button" onClick={resetAnswer}>RESET ANSWER</button><button type="button" onClick={() => forceStable("YES")}>PREVIEW YES</button><button type="button" onClick={() => forceStable("THINK")}>PREVIEW THINK</button></div> : null}
        </aside>
      ) : null}
    </section>
  );
}
