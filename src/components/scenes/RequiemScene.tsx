"use client";

import gsap from "gsap";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { MediaVideo } from "@/components/media/MediaVideo";
import { useAudioEngine, useSceneAudio } from "@/lib/audio/AudioEngineContext";
import {
  calculateRadialPositions,
  REQUIEM_AUDIO,
  REQUIEM_AUDIO_CUES,
  REQUIEM_BUILDUP_TIMING,
  REQUIEM_HERO_VIDEO,
  REQUIEM_RADIAL_CONFIG,
  RequiemClock,
  sampleRequiemEnvelope,
  type RequiemCueName,
} from "@/lib/cinematic/phase12";
import { FILM_MIX } from "@/lib/cinematic/directing";
import { useSceneRuntime } from "@/lib/cinematic/SceneRuntimeContext";
import { useMediaAsset } from "@/lib/media/MediaPreloadContext";
import { safePlayVideo } from "@/lib/media/preloaders";
import { useSoulCollectionRuntime } from "@/lib/souls/SoulCollectionContext";
import type { ReleasedSoul } from "@/lib/souls/SoulCollectionRuntime";
import type { ParticleFieldController } from "@/lib/visuals/VisualRuntime";
import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";
import { createSceneVisualScopeId } from "@/lib/visuals/VisualScope";
import {
  CinematicFractureController,
  type CinematicFracturePreset,
} from "@/lib/visuals/cinematic-fracture";

import styles from "./RequiemScene.module.css";

type RequiemStyle = CSSProperties & Record<`--${string}`, string | number>;

const ARC_SEGMENTS = Object.freeze([
  { rotation: -90, frame: "0% 0%" },
  { rotation: -30, frame: "100% 0%" },
  { rotation: 30, frame: "0% 50%" },
  { rotation: 90, frame: "100% 50%" },
  { rotation: 150, frame: "0% 100%" },
  { rotation: 210, frame: "100% 100%" },
]);

const REQUIEM_FRACTURES = Object.freeze({
  pressureAccent: Object.freeze({
    intensity: 0.22, sliceAmount: 4, sliceCount: 2, chromaticOffset: 0.8,
    verticalShear: 0, lumaTear: 0.04, frameEcho: 0, scanlineWarp: 0.06,
    edgeEnergy: 0.06, duration: 72, seed: 1201, blackTears: 0, radialStretch: 0.004,
  }),
  ignition: Object.freeze({
    intensity: 0.48, sliceAmount: 8, sliceCount: 4, chromaticOffset: 1.6,
    verticalShear: 1.1, lumaTear: 0.08, frameEcho: 0.06, scanlineWarp: 0.12,
    edgeEnergy: 0.14, duration: 108, seed: 1202, blackTears: 0, radialStretch: 0.009,
  }),
  primaryImpact: Object.freeze({
    intensity: 1, sliceAmount: 18, sliceCount: 7, chromaticOffset: 3.5,
    verticalShear: 3, lumaTear: 0.18, frameEcho: 0.12, scanlineWarp: 0.24,
    edgeEnergy: 0.36, duration: 196, seed: 1203, blackTears: 2, radialStretch: 0.026,
  }),
  secondaryWave: Object.freeze({
    intensity: 0.62, sliceAmount: 11, sliceCount: 5, chromaticOffset: 2.2,
    verticalShear: 1.4, lumaTear: 0.1, frameEcho: 0.07, scanlineWarp: 0.15,
    edgeEnergy: 0.2, duration: 128, seed: 1204, blackTears: 1, radialStretch: 0.013,
  }),
  finalSurge: Object.freeze({
    intensity: 0.76, sliceAmount: 14, sliceCount: 6, chromaticOffset: 2.8,
    verticalShear: 2, lumaTear: 0.14, frameEcho: 0.09, scanlineWarp: 0.2,
    edgeEnergy: 0.28, duration: 154, seed: 1205, blackTears: 1, radialStretch: 0.018,
  }),
  tailRelease: Object.freeze({
    intensity: 0.3, sliceAmount: 5, sliceCount: 2, chromaticOffset: 0.6,
    verticalShear: 0, lumaTear: 0.05, frameEcho: 0, scanlineWarp: 0.06,
    edgeEnergy: 0.08, duration: 82, seed: 1206, blackTears: 0, radialStretch: 0.004,
  }),
} satisfies Readonly<Record<Exclude<RequiemCueName, "hardCut">, CinematicFracturePreset>>);

function isSyncDebugEnabled(): boolean {
  return process.env.NODE_ENV === "development" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("requiemSync") === "1";
}

export function RequiemScene() {
  const rootRef = useRef<HTMLElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const fractureHostRef = useRef<HTMLDivElement>(null);
  const fractureControllerRef = useRef<CinematicFractureController | null>(null);
  const smokeRef = useRef<HTMLVideoElement>(null);
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const clockRef = useRef<RequiemClock | null>(null);
  const orbitParticlesRef = useRef<ParticleFieldController | null>(null);
  const impactParticlesRef = useRef<ParticleFieldController | null>(null);
  const rafRef = useRef(0);
  const entryStartedRef = useRef(false);
  const playbackStartedRef = useRef(false);
  const hardCutCommittedRef = useRef(false);
  const radialRef = useRef(calculateRadialPositions(1, 1));
  const [status, setStatus] = useState("arranging");
  const [heroElapsed, setHeroElapsed] = useState(-1);
  const [firedCues, setFiredCues] = useState<readonly RequiemCueName[]>([]);
  const [videoState, setVideoState] = useState("prepared");
  const [heroVideoState, setHeroVideoState] = useState("prepared");
  const [syncDebug, setSyncDebug] = useState(false);
  const debugUpdateRef = useRef(0);
  const { phase, runId, completeEnter, completeExit, setCanAdvance, requestAdvance } = useSceneRuntime();
  const audio = useAudioEngine();
  const sceneAudio = useSceneAudio();
  const collection = useSoulCollectionRuntime();
  const visual = useVisualRuntime();
  const scopeId = createSceneVisualScopeId("REQUIEM", runId);
  const sigil = useMediaAsset("visual:requirements.asset02");
  const arcs = useMediaAsset("visual:requirements.asset03");
  const smoke = useMediaAsset("visual:requirements.asset04");
  const shadowFiend = useMediaAsset(REQUIEM_HERO_VIDEO.semanticRef);
  const fog = useMediaAsset("visual:global.asset04VariantB");
  const lightLeak = useMediaAsset("visual:global.asset07");

  const attractSouls = useCallback((
    released: readonly ReleasedSoul[],
    radiusRatio: number,
    duration: number,
    curve: number,
    scale: number,
  ) => {
    const mobile = window.innerWidth <= 700;
    const resolvedRadiusRatio = mobile ? Math.max(radiusRatio, 0.165) : radiusRatio;
    const resolvedScale = mobile && radiusRatio <= REQUIEM_RADIAL_CONFIG.inboundRatios[2]
      ? scale * 0.78
      : scale;
    const radial = calculateRadialPositions(window.innerWidth, window.innerHeight, resolvedRadiusRatio);
    radialRef.current = radial;
    if (rootRef.current) rootRef.current.dataset.soulRadiusRatio = resolvedRadiusRatio.toFixed(3);
    released.forEach((soul, index) => {
      const point = radial[index];
      if (!point) return;
      const delay = visual.motionMode === "REDUCED" ? 0 : index * 0.01;
      const delayed = gsap.delayedCall(delay, () => {
        void soul.controller.flyTo(
          { screen: [point.x, point.y], z: (index % 3 - 1) * 0.045 },
          {
            duration,
            curve: (index % 2 === 0 ? 1 : -1) * (curve + (index % 3) * 0.025),
            trail: true,
            scale: resolvedScale,
          },
        );
      });
      visual.addScopeCleanup(scopeId, () => delayed.kill());
    });
  }, [scopeId, visual]);

  const cameraImpulse = useCallback((strength: number) => {
    const target = cameraRef.current;
    if (!target || visual.motionMode === "REDUCED") return;
    const amount = strength * visual.motionIntensity;
    gsap.killTweensOf(target);
    gsap.timeline()
      .to(target, { x: 9 * amount, y: -5 * amount, scale: 1 + 0.022 * amount, duration: 0.055, ease: "power3.out" })
      .to(target, { x: -5 * amount, y: 3 * amount, duration: 0.07, ease: "none" })
      .to(target, { x: 0, y: 0, scale: 1, duration: 0.42, ease: "elastic.out(1, .55)" });
  }, [visual]);

  const fractureFrame = useCallback((cue: Exclude<RequiemCueName, "hardCut">) => {
    const source = cameraRef.current;
    const host = fractureHostRef.current;
    const root = rootRef.current;
    if (!source || !host) return;
    // Reduced motion keeps one strong, still-readable event instead of six
    // repeated jolts through the hero sequence.
    if (visual.motionMode === "REDUCED" && cue !== "primaryImpact") return;
    fractureControllerRef.current ??= new CinematicFractureController(source, host);
    const resolved = fractureControllerRef.current.fracture(REQUIEM_FRACTURES[cue], {
      quality: visual.quality,
      motionMode: visual.motionMode,
      mobile: window.matchMedia("(max-width: 700px)").matches,
    });
    if (root) {
      root.dataset.fractureCue = cue;
      root.dataset.fractureDuration = String(resolved.duration);
      root.dataset.fractureSlices = String(resolved.sliceCount);
    }
  }, [visual]);

  const markPulse = useCallback((name: string) => {
    const root = rootRef.current;
    if (!root) return;
    root.dataset.pulse = "";
    // Force a style flush so repeated, cue-driven pulses restart deterministically.
    void root.offsetWidth;
    root.dataset.pulse = name;
  }, []);

  const releaseSoulsRadially = useCallback((released: readonly ReleasedSoul[]) => {
    const radial = radialRef.current;
    const reach = Math.max(window.innerWidth, window.innerHeight) * REQUIEM_RADIAL_CONFIG.exitRatio;
    released.forEach((soul, index) => {
      const point = radial[index];
      if (!point) return;
      const delay = visual.motionIntensity < 0.5 ? 0 : index * 0.012;
      const delayed = gsap.delayedCall(delay, () => {
        const destination: readonly [number, number] = [
          window.innerWidth / 2 + point.unitX * reach,
          window.innerHeight / 2 + point.unitY * reach,
        ];
        void soul.controller.flyTo(
          { screen: destination, z: (index % 2 ? 0.14 : -0.08) },
          { duration: 1.08, curve: point.unitX * 0.24, trail: true, scale: 0.32 },
        ).then((completed) => {
          if (completed) void soul.controller.dissolve({ duration: 0.58 });
        });
      });
      visual.addScopeCleanup(scopeId, () => delayed.kill());
    });
  }, [scopeId, visual]);

  const commitHardCut = useCallback(() => {
    if (hardCutCommittedRef.current) return;
    hardCutCommittedRef.current = true;
    const root = rootRef.current;
    if (root) root.dataset.requiemPhase = "hard-cut";
    fractureControllerRef.current?.clear();
    visual.enterAbsoluteBlack();
    audio.enterCinematicSilence();
    audio.stopMusic({ fadeSeconds: 0 });
    audio.stopAllAmbient({ fadeSeconds: 0 });
    audio.stopAllSfx();
    audio.stopAllProcedural();
    orbitParticlesRef.current?.dispose();
    impactParticlesRef.current?.dispose();
    orbitParticlesRef.current = null;
    impactParticlesRef.current = null;
    collection.disposeReleasedSouls();
    if (smokeRef.current) {
      smokeRef.current.pause();
      try { smokeRef.current.currentTime = 0; } catch { /* already silent */ }
    }
    if (heroVideoRef.current) {
      heroVideoRef.current.pause();
      try { heroVideoRef.current.currentTime = 0; } catch { /* already silent */ }
    }
    visual.setFog(null, 0, 0);
    visual.setGrain(0);
    visual.setVignette(0, 1);
    visual.setLightLeak(0, { drift: false });
    visual.setCursorMode("HIDDEN");
    setStatus("hard-cut");
    setCanAdvance(true);
    queueMicrotask(requestAdvance);
  }, [audio, collection, requestAdvance, setCanAdvance, visual]);

  useEffect(() => {
    const debugTimer = window.setTimeout(() => setSyncDebug(isSyncDebugEnabled()), 0);
    const smokeVideo = smokeRef.current;
    const heroVideo = heroVideoRef.current;
    visual.leaveAbsoluteBlack();
    audio.leaveCinematicSilence();
    collection.hideHud();
    visual.setCursorMode("HIDDEN");
    visual.setFog("CRIMSON", 0.11, 0.35);
    visual.setGrain(0.018);
    visual.setVignette(0.78, 0.78);
    visual.setVignetteCenter(50, 50);
    visual.setLightLeak(0, { drift: false });
    return () => {
      window.cancelAnimationFrame(rafRef.current);
      clockRef.current?.reset();
      clockRef.current = null;
      orbitParticlesRef.current?.dispose();
      impactParticlesRef.current?.dispose();
      orbitParticlesRef.current = null;
      impactParticlesRef.current = null;
      fractureControllerRef.current?.dispose();
      fractureControllerRef.current = null;
      window.clearTimeout(debugTimer);
      smokeVideo?.pause();
      heroVideo?.pause();
      if (!hardCutCommittedRef.current) {
        audio.leaveCinematicSilence();
        visual.leaveAbsoluteBlack();
      }
    };
  }, [audio, collection, visual]);

  useEffect(() => {
    const video = smokeRef.current;
    if (!video) return;
    video.pause();
    video.muted = true;
    video.playsInline = true;
    try { video.currentTime = 0; } catch { /* metadata can arrive later */ }
  }, [smoke]);

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return;
    video.pause();
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.playbackRate = 1;
    try { video.currentTime = 0; } catch { /* metadata can arrive later */ }
  }, [shadowFiend]);

  useEffect(() => {
    if (phase !== "entering" || entryStartedRef.current) return;
    entryStartedRef.current = true;
    const released = [...collection.getReleasedSouls()].sort((a, b) => a.slotIndex - b.slotIndex);
    if (released.length !== 10 || new Set(released.map((soul) => soul.soulId)).size !== 10) {
      const failureTimer = window.setTimeout(() => setStatus("handoff-failed"), 0);
      completeEnter();
      if (process.env.NODE_ENV === "development") {
        console.warn(`REQUIEM requires 10 unique released Souls; received ${released.length}.`);
      }
      return () => window.clearTimeout(failureTimer);
    }
    radialRef.current = calculateRadialPositions(window.innerWidth, window.innerHeight);
    const timeline = gsap.timeline({
      onComplete: () => {
        setStatus("ready");
        completeEnter();
      },
    });
    released.forEach((soul, index) => {
      timeline.call(() => {
        soul.controller.stopBreathing();
        const point = radialRef.current[index];
        void soul.controller.flyTo(
          { screen: [point.x, point.y], z: (index % 3 - 1) * 0.06 },
          {
            duration: REQUIEM_BUILDUP_TIMING.arrangement,
            curve: (index % 2 === 0 ? 1 : -1) * 0.36,
            trail: true,
            scale: 0.72,
          },
        ).then((completed) => {
          if (completed) soul.controller.startBreathing(0.022);
        });
      }, [], index * REQUIEM_BUILDUP_TIMING.arrangementStagger);
    });
    timeline.to(rootRef.current, { opacity: 1, duration: 0.4, ease: "sine.out" }, 0);
    timeline.to({}, { duration: REQUIEM_BUILDUP_TIMING.arrangement + 0.5 });
    return () => {
      timeline.kill();
      released.forEach((soul) => soul.controller.cancelAnimations());
      entryStartedRef.current = false;
    };
  }, [collection, completeEnter, phase]);

  useEffect(() => {
    if (phase !== "active" || status !== "ready" || playbackStartedRef.current) return;
    let cancelled = false;
    const released = [...collection.getReleasedSouls()].sort((a, b) => a.slotIndex - b.slotIndex);

    void (async () => {
      try {
        const catalog = await audio.getCatalog();
        const ids = Object.values(REQUIEM_AUDIO).map((ref) => catalog.getBySemanticRef(ref).id);
        await Promise.race([
          audio.prepareSfx(ids),
          new Promise<number>((resolve) => window.setTimeout(() => resolve(0), 2200)),
        ]);
      } catch (error) {
        if (process.env.NODE_ENV === "development") console.warn("Requiem audio preparation degraded.", error);
      }
      if (cancelled) return;
      if (playbackStartedRef.current) return;
      playbackStartedRef.current = true;

      const audioNow = audio.getCurrentTime();
      let usingAudioClock = audioNow !== null;
      const clockNow = audioNow ?? performance.now() / 1000;
      let fallbackStartedAt = performance.now() / 1000;
      let fallbackTimelineAt = clockNow;
      let lastAudioClock = audioNow;
      let lastAudioAdvanceAt = fallbackStartedAt;
      const buildupStart = clockNow + REQUIEM_BUILDUP_TIMING.scheduleLead;
      const heroStart = buildupStart + REQUIEM_BUILDUP_TIMING.heroStart;
      const hardCutAt = heroStart + REQUIEM_AUDIO_CUES.cues.hardCut;
      const buildupFired = new Set<string>();
      const fired: RequiemCueName[] = [];
      clockRef.current = new RequiemClock(heroStart, runId);
      if (rootRef.current) {
        rootRef.current.dataset.clockMode = usingAudioClock ? "audio" : "fallback";
      }

      const schedule = (ref: string, at: number, gain: number) => {
        if (!audio.getSnapshot().isUnlocked) return;
        void sceneAudio.playSfx(ref, { when: at, gain, duckMusic: false });
      };
      schedule(REQUIEM_AUDIO.ring1, buildupStart + REQUIEM_BUILDUP_TIMING.ring1, FILM_MIX.sfx.requiemRing1);
      schedule(REQUIEM_AUDIO.ring2, buildupStart + REQUIEM_BUILDUP_TIMING.ring2, FILM_MIX.sfx.requiemRing2);
      schedule(REQUIEM_AUDIO.ring3, buildupStart + REQUIEM_BUILDUP_TIMING.ring3, FILM_MIX.sfx.requiemRing3);
      schedule(REQUIEM_AUDIO.arcs, buildupStart + REQUIEM_BUILDUP_TIMING.arcs, FILM_MIX.sfx.requiemArcs);
      if (audio.getSnapshot().isUnlocked) {
        void audio.playRequiem({ when: heroStart, gain: FILM_MIX.sfx.requiemHero, scopeId: sceneAudio.scopeId, duckMusic: false });
        audio.enterCinematicSilence({ atAudioTime: hardCutAt });
      }

      orbitParticlesRef.current = visual.spawnParticleField({
        mode: "ORBIT",
        count: 440,
        position: [0, 0, 0],
        spread: [7.4, 7.4, 2.2],
        size: [0.012, 0.065],
        opacity: 0.22,
        velocity: 0.22,
        color: "#d31c3e",
        depthRange: [-2.2, 2.2],
        scopeId,
      });

      const fireBuildup = (name: string, at: number, action: () => void, elapsed: number) => {
        if (elapsed >= at && !buildupFired.has(name)) {
          buildupFired.add(name);
          action();
        }
      };

      const handleHeroCue = (cue: RequiemCueName) => {
        fired.push(cue);
        const root = rootRef.current;
        if (root) root.dataset.currentCue = cue;
        if (cue === "pressureAccent") {
          markPulse("pressure");
          fractureFrame("pressureAccent");
          cameraImpulse(0.22);
        } else if (cue === "ignition") {
          markPulse("ignition");
          fractureFrame("ignition");
          cameraImpulse(0.42);
        } else if (cue === "primaryImpact") {
          if (root) {
            root.dataset.requiemPhase = "release";
            root.dataset.reviewStage = "HERO_RELEASE";
          }
          markPulse("primary");
          fractureFrame("primaryImpact");
          cameraImpulse(1);
          releaseSoulsRadially(released);
          impactParticlesRef.current = visual.spawnParticleField({
            mode: "BURST",
            count: 520,
            position: [0, 0, 0],
            spread: [0.7, 0.7, 0.8],
            size: [0.018, 0.085],
            opacity: 0.88,
            velocity: 1.65,
            lifetime: 2.2,
            fade: 0.7,
            color: "#ef3153",
            scopeId,
          });
          if (smokeRef.current) {
            try { smokeRef.current.currentTime = 0; } catch { /* prepared fallback remains */ }
            void safePlayVideo(smokeRef.current).then((result) => setVideoState(result.played ? "playing" : "failed"));
          }
        } else if (cue === "secondaryWave") {
          markPulse("secondary");
          fractureFrame("secondaryWave");
          cameraImpulse(0.62);
        } else if (cue === "finalSurge") {
          markPulse("final");
          fractureFrame("finalSurge");
          cameraImpulse(0.72);
        } else if (cue === "tailRelease") {
          if (root) {
            root.dataset.requiemPhase = "tail";
            root.dataset.reviewStage = "PRE_HARD_CUT";
          }
          markPulse("tail");
          fractureFrame("tailRelease");
        } else if (cue === "hardCut") {
          commitHardCut();
        }
      };

      const frame = () => {
        if (cancelled || hardCutCommittedRef.current) return;
        const wallNow = performance.now() / 1000;
        let now = usingAudioClock
          ? audio.getCurrentTime()
          : fallbackTimelineAt + (wallNow - fallbackStartedAt);
        if (usingAudioClock && now !== null) {
          if (lastAudioClock === null || now > lastAudioClock + 0.001) {
            lastAudioClock = now;
            lastAudioAdvanceAt = wallNow;
          } else if (!document.hidden && wallNow - lastAudioAdvanceAt > 1.5) {
            usingAudioClock = false;
            fallbackTimelineAt = now;
            fallbackStartedAt = wallNow;
            rootRef.current?.setAttribute("data-clock-mode", "fallback-interruption");
          }
        }
        if (now === null) {
          usingAudioClock = false;
          fallbackTimelineAt = lastAudioClock ?? clockNow;
          fallbackStartedAt = wallNow;
          now = fallbackTimelineAt;
          rootRef.current?.setAttribute("data-clock-mode", "fallback-unavailable");
        }
        const buildupElapsed = now - buildupStart;
        const root = rootRef.current;
        fireBuildup("ring1", REQUIEM_BUILDUP_TIMING.ring1, () => {
          if (root) root.dataset.rings = "1";
          if (root) root.dataset.reviewStage = "SOULS_INBOUND";
          attractSouls(released, REQUIEM_RADIAL_CONFIG.inboundRatios[0], 0.72, 0.34, 0.74);
        }, buildupElapsed);
        fireBuildup("ring2", REQUIEM_BUILDUP_TIMING.ring2, () => {
          if (root) root.dataset.rings = "2";
          attractSouls(released, REQUIEM_RADIAL_CONFIG.inboundRatios[1], 0.7, 0.28, 0.76);
        }, buildupElapsed);
        fireBuildup("ring3", REQUIEM_BUILDUP_TIMING.ring3, () => {
          if (root) root.dataset.rings = "3";
          attractSouls(released, REQUIEM_RADIAL_CONFIG.inboundRatios[2], 0.64, 0.22, 0.78);
          released.forEach((soul, index) => {
            const delayed = gsap.delayedCall(index * 0.052 * visual.motionIntensity, () => {
              void soul.controller.charge({ duration: 0.62, intensity: 1.04 });
            });
            visual.addScopeCleanup(scopeId, () => delayed.kill());
          });
        }, buildupElapsed);
        fireBuildup("arcs", REQUIEM_BUILDUP_TIMING.arcs, () => {
          if (root) root.dataset.requiemPhase = "arcs";
          attractSouls(released, REQUIEM_RADIAL_CONFIG.inboundRatios[3], 0.5, 0.16, 0.8);
          orbitParticlesRef.current?.update({ velocity: 0.72, opacity: 0.5, spread: [5.5, 5.5, 1.8] });
        }, buildupElapsed);
        fireBuildup("contraction", REQUIEM_BUILDUP_TIMING.contraction, () => {
          if (root) root.dataset.requiemPhase = "compressed";
          if (root) root.dataset.reviewStage = "CENTER_GATHER";
          attractSouls(released, REQUIEM_RADIAL_CONFIG.gatheredRatio, 0.3, 0.11, 0.8);
          orbitParticlesRef.current?.update({ velocity: 1.15, opacity: 0.66, spread: [4.2, 4.2, 1.4] });
          if (cameraRef.current && visual.motionMode !== "REDUCED") {
            gsap.timeline()
              .to(cameraRef.current, { scale: 0.985, duration: 0.34, ease: "power2.in" })
              .to(cameraRef.current, { scale: 1, duration: 0.17, ease: "power3.out" });
          }
        }, buildupElapsed);
        fireBuildup("shadow-fiend", REQUIEM_BUILDUP_TIMING.heroStart - REQUIEM_HERO_VIDEO.startBeforeHero, () => {
          if (root) root.dataset.reviewStage = "SF_ESTABLISHED";
          attractSouls(released, REQUIEM_RADIAL_CONFIG.lockedRatio, 0.24, 0.08, 0.82);
          const video = heroVideoRef.current;
          if (!video) {
            setHeroVideoState("failed");
            return;
          }
          try { video.currentTime = 0; } catch { /* the prepared fallback remains */ }
          void safePlayVideo(video).then((result) => setHeroVideoState(result.played ? "playing" : "failed"));
        }, buildupElapsed);
        fireBuildup("hero", REQUIEM_BUILDUP_TIMING.heroStart, () => {
          if (root) root.dataset.requiemPhase = "hero";
          if (root) root.dataset.reviewStage = "CAST_START";
        }, buildupElapsed);

        const elapsed = now - heroStart;
        if (syncDebug && root && now - debugUpdateRef.current > 0.08) {
          root.dataset.soulPositions = JSON.stringify(
            released.map((soul) => soul.controller.getPosition()?.map((value) => Number(value.toFixed(2)))),
          );
        }
        if (elapsed >= 0 && clockRef.current) {
          const heroVideo = heroVideoRef.current;
          const desiredHeroTime = elapsed + REQUIEM_HERO_VIDEO.startBeforeHero;
          if (
            heroVideo &&
            desiredHeroTime >= 0 &&
            desiredHeroTime < REQUIEM_HERO_VIDEO.sourceDuration &&
            heroVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            Math.abs(heroVideo.currentTime - desiredHeroTime) > REQUIEM_HERO_VIDEO.resyncThreshold
          ) {
            try { heroVideo.currentTime = desiredHeroTime; } catch { /* keep continuous playback */ }
          }
          for (const cue of clockRef.current.tick(now, runId)) handleHeroCue(cue);
          const envelope = sampleRequiemEnvelope(elapsed);
          root?.style.setProperty("--hero-envelope", envelope.toFixed(4));
          orbitParticlesRef.current?.updateContinuous({
            opacity: Math.min(0.82, 0.32 + envelope * 0.48),
            velocity: 0.82 + envelope * 1.15,
          });
          if (syncDebug && now - debugUpdateRef.current > 0.08) {
            debugUpdateRef.current = now;
            setHeroElapsed(elapsed);
            setFiredCues([...fired]);
            if (root) root.dataset.heroVideoTime = heroVideo?.currentTime.toFixed(3) ?? "unavailable";
          }
        }
        rafRef.current = window.requestAnimationFrame(frame);
      };
      rafRef.current = window.requestAnimationFrame(frame);
    })();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafRef.current);
      if (!hardCutCommittedRef.current) playbackStartedRef.current = false;
    };
  }, [attractSouls, audio, cameraImpulse, collection, commitHardCut, fractureFrame, markPulse, phase, releaseSoulsRadially, runId, sceneAudio, scopeId, status, syncDebug, visual]);

  useEffect(() => {
    if (phase !== "exiting") return;
    completeExit();
  }, [completeExit, phase]);

  const mediaStyle: RequiemStyle = {
    "--sigil-image": sigil ? `url("${sigil.url}")` : "none",
    "--arc-image": arcs ? `url("${arcs.url}")` : "none",
    "--leak-image": lightLeak ? `url("${lightLeak.url}")` : "none",
  };

  return (
    <section
      ref={rootRef}
      className={styles.scene}
      style={mediaStyle}
      data-testid="requiem-scene"
      data-status={status}
      data-rings="0"
      data-requiem-phase="arranging"
      data-review-stage="HUD_RELEASE"
      data-soul-radius-ratio={REQUIEM_RADIAL_CONFIG.radiusRatio.toFixed(3)}
      data-current-cue="none"
      data-fracture-cue="none"
      data-fracture-duration="0"
      data-fracture-slices="0"
      data-video-state={videoState}
      data-hero-video-state={heroVideoState}
      data-quality={visual.quality}
      data-released-count={collection.getSnapshot().releasedCount}
      data-hero-clock="AudioContext.currentTime"
      aria-label="Requiem"
    >
      <div ref={cameraRef} className={styles.camera}>
        <div className={styles.fogSuction} aria-hidden="true">
          {fog ? <MediaVideo asset={fog} muted playsInline autoPlay loop resetOnUnmount /> : null}
        </div>
        <div className={styles.sigil} aria-hidden="true">
          <span className={styles.sigilBase} />
          <span className={`${styles.ring} ${styles.ring1}`} />
          <span className={`${styles.ring} ${styles.ring2}`} />
          <span className={`${styles.ring} ${styles.ring3}`} />
          <span className={styles.core} />
        </div>
        <div className={styles.shadowFiend} aria-hidden="true">
          {shadowFiend ? (
            <MediaVideo
              ref={heroVideoRef}
              asset={shadowFiend}
              muted
              playsInline
              preload="auto"
              resetOnUnmount
              onPlaybackResult={(result) => setHeroVideoState(result.played ? "playing" : "failed")}
            />
          ) : null}
          <span className={styles.heroIntegrationGlow} />
        </div>
        <div className={styles.arcs} aria-hidden="true">
          {ARC_SEGMENTS.map((segment) => (
            <span
              key={segment.rotation}
              className={styles.arc}
              style={{
                "--arc-rotation": `${segment.rotation}deg`,
                backgroundPosition: segment.frame,
              } as RequiemStyle}
            />
          ))}
        </div>
        <div className={styles.smokeBurst} aria-hidden="true">
          {smoke ? (
            <MediaVideo
              ref={smokeRef}
              asset={smoke}
              muted
              playsInline
              resetOnUnmount
              onPlaybackResult={(result) => setVideoState(result.played ? "playing" : "failed")}
            />
          ) : null}
        </div>
        <div className={styles.lightLeak} aria-hidden="true" />
        <span className={`${styles.shockwave} ${styles.shockwaveA}`} aria-hidden="true" />
        <span className={`${styles.shockwave} ${styles.shockwaveB}`} aria-hidden="true" />
        <div className={styles.flash} aria-hidden="true" />
      </div>
      <div ref={fractureHostRef} className={styles.fractureHost} data-cinematic-fracture-host="true" aria-hidden="true" />
      {process.env.NODE_ENV === "development" && status === "handoff-failed" ? (
        <output className={styles.warning}>REQUIEM requires 10 released Soul controllers.</output>
      ) : null}
      {syncDebug ? (
        <aside className={styles.syncPanel} data-testid="requiem-sync-panel">
          <strong>REQUIEM SYNC</strong>
          <span>duration {REQUIEM_AUDIO_CUES.duration.toFixed(3)}s</span>
          <span>hero {heroElapsed.toFixed(3)}s · cut {REQUIEM_AUDIO_CUES.cues.hardCut.toFixed(3)}s</span>
          <span>context {audio.getSnapshot().contextState} · smoke {videoState} · SF {heroVideoState}</span>
          <span>souls {collection.getSnapshot().releasedCount} · {status}</span>
          <span>fired {firedCues.join(", ") || "none"}</span>
          <div className={styles.waveform} aria-label="AUD-REQ-05 normalized RMS envelope">
            {REQUIEM_AUDIO_CUES.normalizedRmsEnvelope.map((value, index) => (
              <i key={index} style={{ height: `${Math.max(2, value * 100)}%` }} />
            ))}
          </div>
        </aside>
      ) : null}
    </section>
  );
}
