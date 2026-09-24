"use client";

import gsap from "gsap";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import { MediaImage } from "@/components/media/MediaImage";
import { MediaVideo } from "@/components/media/MediaVideo";
import { useAudioEngine, useSceneAudio } from "@/lib/audio/AudioEngineContext";
import {
  calculateRadialPositions,
  REQUIEM_AUDIO,
  REQUIEM_AUDIO_CUES,
  REQUIEM_BUILDUP_TIMING,
  REQUIEM_RADIAL_CONFIG,
  RequiemClock,
  sampleRequiemEnvelope,
  type RequiemCueName,
} from "@/lib/cinematic/phase12";
import { useSceneRuntime } from "@/lib/cinematic/SceneRuntimeContext";
import { useMediaAsset } from "@/lib/media/MediaPreloadContext";
import { safePlayVideo } from "@/lib/media/preloaders";
import { useSoulCollectionRuntime } from "@/lib/souls/SoulCollectionContext";
import type { ReleasedSoul } from "@/lib/souls/SoulCollectionRuntime";
import type { ParticleFieldController } from "@/lib/visuals/VisualRuntime";
import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";
import { createSceneVisualScopeId } from "@/lib/visuals/VisualScope";

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

function isSyncDebugEnabled(): boolean {
  return process.env.NODE_ENV === "development" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("requiemSync") === "1";
}

export function RequiemScene() {
  const rootRef = useRef<HTMLElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const smokeRef = useRef<HTMLVideoElement>(null);
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
  const fog = useMediaAsset("visual:global.asset04VariantB");
  const displacement = useMediaAsset("visual:global.asset06");
  const lightLeak = useMediaAsset("visual:global.asset07");

  const cameraImpulse = useCallback((strength: number) => {
    const target = cameraRef.current;
    if (!target) return;
    const amount = strength * visual.motionIntensity;
    gsap.killTweensOf(target);
    gsap.timeline()
      .to(target, { x: 9 * amount, y: -5 * amount, scale: 1 + 0.022 * amount, duration: 0.055, ease: "power3.out" })
      .to(target, { x: -5 * amount, y: 3 * amount, duration: 0.07, ease: "none" })
      .to(target, { x: 0, y: 0, scale: 1, duration: 0.42, ease: "elastic.out(1, .55)" });
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
      window.clearTimeout(debugTimer);
      smokeVideo?.pause();
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
      const usingAudioClock = audioNow !== null;
      const clockNow = audioNow ?? performance.now() / 1000;
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
      schedule(REQUIEM_AUDIO.ring1, buildupStart + REQUIEM_BUILDUP_TIMING.ring1, 0.72);
      schedule(REQUIEM_AUDIO.ring2, buildupStart + REQUIEM_BUILDUP_TIMING.ring2, 0.74);
      schedule(REQUIEM_AUDIO.ring3, buildupStart + REQUIEM_BUILDUP_TIMING.ring3, 0.78);
      schedule(REQUIEM_AUDIO.arcs, buildupStart + REQUIEM_BUILDUP_TIMING.arcs, 0.67);
      if (audio.getSnapshot().isUnlocked) {
        void audio.playRequiem({ when: heroStart, gain: 0.92, scopeId: sceneAudio.scopeId, duckMusic: false });
        audio.enterCinematicSilence({ atAudioTime: hardCutAt });
      }

      orbitParticlesRef.current = visual.spawnParticleField({
        mode: "ORBIT",
        count: visual.quality === "HIGH" ? 440 : visual.quality === "MEDIUM" ? 300 : 176,
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
          cameraImpulse(0.22);
        } else if (cue === "ignition") {
          markPulse("ignition");
          cameraImpulse(0.42);
        } else if (cue === "primaryImpact") {
          if (root) root.dataset.requiemPhase = "release";
          markPulse("primary");
          cameraImpulse(1);
          releaseSoulsRadially(released);
          impactParticlesRef.current = visual.spawnParticleField({
            mode: "BURST",
            count: visual.quality === "HIGH" ? 520 : visual.quality === "MEDIUM" ? 340 : 190,
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
          cameraImpulse(0.62);
        } else if (cue === "finalSurge") {
          markPulse("final");
          cameraImpulse(0.72);
        } else if (cue === "tailRelease") {
          if (root) root.dataset.requiemPhase = "tail";
          markPulse("tail");
        } else if (cue === "hardCut") {
          commitHardCut();
        }
      };

      const frame = () => {
        if (cancelled || hardCutCommittedRef.current) return;
        const now = usingAudioClock ? audio.getCurrentTime() : performance.now() / 1000;
        if (now === null) {
          rafRef.current = window.requestAnimationFrame(frame);
          return;
        }
        const buildupElapsed = now - buildupStart;
        const root = rootRef.current;
        fireBuildup("ring1", REQUIEM_BUILDUP_TIMING.ring1, () => {
          if (root) root.dataset.rings = "1";
        }, buildupElapsed);
        fireBuildup("ring2", REQUIEM_BUILDUP_TIMING.ring2, () => {
          if (root) root.dataset.rings = "2";
        }, buildupElapsed);
        fireBuildup("ring3", REQUIEM_BUILDUP_TIMING.ring3, () => {
          if (root) root.dataset.rings = "3";
          released.forEach((soul, index) => {
            const delayed = gsap.delayedCall(index * 0.052 * visual.motionIntensity, () => {
              void soul.controller.charge({ duration: 0.62, intensity: 1.04 });
            });
            visual.addScopeCleanup(scopeId, () => delayed.kill());
          });
        }, buildupElapsed);
        fireBuildup("arcs", REQUIEM_BUILDUP_TIMING.arcs, () => {
          if (root) root.dataset.requiemPhase = "arcs";
          orbitParticlesRef.current?.update({ velocity: 0.72, opacity: 0.5, spread: [5.5, 5.5, 1.8] });
        }, buildupElapsed);
        fireBuildup("contraction", REQUIEM_BUILDUP_TIMING.contraction, () => {
          if (root) root.dataset.requiemPhase = "compressed";
          radialRef.current = calculateRadialPositions(
            window.innerWidth,
            window.innerHeight,
            REQUIEM_RADIAL_CONFIG.radiusRatio * REQUIEM_RADIAL_CONFIG.contractedRatio,
          );
          released.forEach((soul, index) => {
            const point = radialRef.current[index];
            void soul.controller.flyTo({ screen: [point.x, point.y] }, { duration: 0.48, curve: 0.08, trail: true, scale: 0.76 });
          });
          orbitParticlesRef.current?.update({ velocity: 1.15, opacity: 0.66, spread: [4.2, 4.2, 1.4] });
        }, buildupElapsed);
        fireBuildup("hero", REQUIEM_BUILDUP_TIMING.heroStart, () => {
          if (root) root.dataset.requiemPhase = "hero";
        }, buildupElapsed);

        const elapsed = now - heroStart;
        if (syncDebug && root && now - debugUpdateRef.current > 0.08) {
          root.dataset.soulPositions = JSON.stringify(
            released.map((soul) => soul.controller.getPosition()?.map((value) => Number(value.toFixed(2)))),
          );
        }
        if (elapsed >= 0 && clockRef.current) {
          for (const cue of clockRef.current.tick(now, runId)) handleHeroCue(cue);
          const envelope = sampleRequiemEnvelope(elapsed);
          root?.style.setProperty("--hero-envelope", envelope.toFixed(4));
          root?.style.setProperty("--hero-distortion", (0.04 + envelope * 0.3 * visual.motionIntensity).toFixed(4));
          orbitParticlesRef.current?.updateContinuous({
            opacity: Math.min(0.82, 0.32 + envelope * 0.48),
            velocity: 0.82 + envelope * 1.15,
          });
          if (syncDebug && now - debugUpdateRef.current > 0.08) {
            debugUpdateRef.current = now;
            setHeroElapsed(elapsed);
            setFiredCues([...fired]);
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
  }, [audio, cameraImpulse, collection, commitHardCut, markPulse, phase, releaseSoulsRadially, runId, sceneAudio, scopeId, status, syncDebug, visual]);

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
      data-current-cue="none"
      data-video-state={videoState}
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
        <div className={styles.displacement} aria-hidden="true">
          {displacement ? <MediaImage asset={displacement} alt="" eager /> : null}
        </div>
        <div className={styles.lightLeak} aria-hidden="true" />
        <span className={`${styles.shockwave} ${styles.shockwaveA}`} aria-hidden="true" />
        <span className={`${styles.shockwave} ${styles.shockwaveB}`} aria-hidden="true" />
        <div className={styles.flash} aria-hidden="true" />
      </div>
      {process.env.NODE_ENV === "development" && status === "handoff-failed" ? (
        <output className={styles.warning}>REQUIEM requires 10 released Soul controllers.</output>
      ) : null}
      {syncDebug ? (
        <aside className={styles.syncPanel} data-testid="requiem-sync-panel">
          <strong>REQUIEM SYNC</strong>
          <span>duration {REQUIEM_AUDIO_CUES.duration.toFixed(3)}s</span>
          <span>hero {heroElapsed.toFixed(3)}s · cut {REQUIEM_AUDIO_CUES.cues.hardCut.toFixed(3)}s</span>
          <span>context {audio.getSnapshot().contextState} · video {videoState}</span>
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
