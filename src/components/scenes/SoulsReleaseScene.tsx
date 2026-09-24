"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";

import { useAudioEngine, useSceneAudio } from "@/lib/audio/AudioEngineContext";
import { SOULS_RELEASE_TIMING, releasePreconditionMet } from "@/lib/cinematic/phase12";
import { useSceneRuntime } from "@/lib/cinematic/SceneRuntimeContext";
import { useSoulCollectionRuntime } from "@/lib/souls/SoulCollectionContext";
import type { ReleasedSoul } from "@/lib/souls/SoulCollectionRuntime";
import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";
import { createSceneVisualScopeId } from "@/lib/visuals/VisualScope";

import styles from "./SoulsReleaseScene.module.css";

const CONSTELLATION = Object.freeze([
  [-0.34, -0.18], [-0.17, -0.3], [0.03, -0.24], [0.25, -0.31], [0.36, -0.1],
  [0.3, 0.18], [0.12, 0.3], [-0.08, 0.23], [-0.29, 0.29], [-0.39, 0.05],
] as const);

function constellationPoint(index: number): readonly [number, number] {
  const [x, y] = CONSTELLATION[index] ?? [0, 0];
  const span = Math.min(window.innerWidth, window.innerHeight);
  return [window.innerWidth / 2 + x * span, window.innerHeight / 2 + y * span];
}

export function SoulsReleaseScene() {
  const rootRef = useRef<HTMLElement>(null);
  const startedRef = useRef(false);
  const [status, setStatus] = useState("checking");
  const { phase, runId, completeEnter, completeExit, setCanAdvance, requestAdvance } = useSceneRuntime();
  const audio = useAudioEngine();
  const sceneAudio = useSceneAudio();
  const collection = useSoulCollectionRuntime();
  const visual = useVisualRuntime();
  const scopeId = createSceneVisualScopeId("SOULS_RELEASE", runId);

  useEffect(() => {
    visual.leaveAbsoluteBlack();
    audio.leaveCinematicSilence();
    visual.setCursorMode("HIDDEN");
    visual.setFog("CRIMSON", 0.075, 0.6);
    visual.setGrain(0.012);
    visual.setVignette(0.7, 0.88);
    visual.setVignetteCenter(50, 50);
    visual.setLightLeak(0, { drift: false });
    collection.showHud();
    audio.stopMusic({ fadeSeconds: SOULS_RELEASE_TIMING.musicFade });
    const particles = visual.spawnParticleField({
      mode: "AMBIENT_DRIFT",
      count: 44,
      position: [0, 0, 0],
      spread: [8, 4.8, 2],
      size: [0.012, 0.04],
      opacity: 0.11,
      velocity: 0.025,
      drift: 0.035,
      color: "#8d1028",
      scopeId,
    });
    return () => {
      particles.dispose();
      for (const released of collection.getReleasedSouls()) released.controller.cancelAnimations();
    };
  }, [audio, collection, scopeId, visual]);

  useEffect(() => {
    if (phase !== "entering" || startedRef.current) return;
    startedRef.current = true;
    const snapshot = collection.getSnapshot();
    if (!releasePreconditionMet(snapshot.count)) {
      const failureTimer = window.setTimeout(() => setStatus("precondition-failed"), 0);
      completeEnter();
      if (process.env.NODE_ENV === "development") {
        console.warn(`SOULS_RELEASE requires exactly 10/10 Souls; received ${snapshot.count}/10.`);
      }
      return () => window.clearTimeout(failureTimer);
    }

    let cancelled = false;
    void (async () => {
      let result = await collection.releaseAllForRequiem();
      if (result.status === "already-released" && process.env.NODE_ENV === "development") {
        result = collection.restoreReleasedSoulsToHudSlotsForReplay();
      }
      if (cancelled) return;
      if ((result.status !== "released" && result.status !== "already-released") || result.releasedCount !== 10) {
        setStatus(`release-${result.status}`);
        completeEnter();
        if (process.env.NODE_ENV === "development") console.warn("SOULS_RELEASE transaction failed.", result);
        return;
      }
      setStatus("released");
      completeEnter();
    })();
    return () => {
      cancelled = true;
      startedRef.current = false;
    };
  }, [collection, completeEnter, phase]);

  useEffect(() => {
    if (phase !== "active" || status !== "released") return;
    const released = [...collection.getReleasedSouls()].sort((a, b) => a.slotIndex - b.slotIndex);
    if (released.length !== 10) {
      const failureTimer = window.setTimeout(() => setStatus("handoff-failed"), 0);
      return () => window.clearTimeout(failureTimer);
    }
    const timeline = gsap.timeline();
    released.forEach((soul: ReleasedSoul, index) => {
      const at = index * SOULS_RELEASE_TIMING.detachStagger;
      timeline.call(() => {
        void soul.controller.spawn({
          duration: SOULS_RELEASE_TIMING.detachSpawn,
          scale: 0.78,
          state: "ACTIVE",
        }).then((completed) => {
          if (!completed) return;
          soul.controller.startBreathing(0.018);
          void soul.controller.flyTo(
            { screen: constellationPoint(index), z: (index % 3 - 1) * 0.08 },
            {
              duration: SOULS_RELEASE_TIMING.constellationFlight,
              curve: (index % 2 === 0 ? 1 : -1) * (0.55 + index * 0.025),
              trail: true,
              scale: 0.72,
            },
          );
        });
        if ([0, 3, 6, 9].includes(index) && audio.getSnapshot().isUnlocked) {
          void sceneAudio.playSfx("audio:global.soulFly", {
            gain: 0.11,
            pan: -0.42 + index * 0.09,
            playbackRate: 0.9 + index * 0.018,
          });
        }
      }, [], at);
    });
    timeline.call(() => {
      collection.hideHud();
    }, [], SOULS_RELEASE_TIMING.hudDisintegrateAt);
    timeline.call(() => {
      setStatus("complete");
      setCanAdvance(true);
      queueMicrotask(requestAdvance);
    }, [], SOULS_RELEASE_TIMING.autoAdvance);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [audio, collection, phase, requestAdvance, sceneAudio, scopeId, setCanAdvance, status, visual]);

  useEffect(() => {
    if (phase !== "exiting") return;
    const delayed = gsap.delayedCall(SOULS_RELEASE_TIMING.exit, completeExit);
    return () => { delayed.kill(); };
  }, [completeExit, phase]);

  return (
    <section
      ref={rootRef}
      className={styles.scene}
      data-testid="souls-release-scene"
      data-release-status={status}
      data-released-count={collection.getSnapshot().releasedCount}
      aria-label="Souls release"
    >
      <div className={styles.voidGlow} aria-hidden="true" />
      {process.env.NODE_ENV === "development" && status.includes("failed") ? (
        <output className={styles.warning}>SOULS_RELEASE: {status}</output>
      ) : null}
    </section>
  );
}
