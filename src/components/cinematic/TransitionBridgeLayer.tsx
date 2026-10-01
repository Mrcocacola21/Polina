"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { useAudioEngine } from "@/lib/audio/AudioEngineContext";
import type { MusicToneHandle } from "@/lib/audio/types";
import { FILM_MIX } from "@/lib/cinematic/directing";
import { getMemoryTransitionMetrics, MEMORY_TO_THREAD } from "@/lib/cinematic/memory-transition";
import { useTransitionRuntime, useTransitionSnapshot } from "@/lib/cinematic/TransitionRuntimeContext";
import { useCapabilities } from "@/lib/accessibility/CapabilityContext";

import styles from "./TransitionBridgeLayer.module.css";

const PARTICLES = Array.from({ length: 14 }, (_, index) => index);

export function TransitionBridgeLayer() {
  const runtime = useTransitionRuntime();
  const snapshot = useTransitionSnapshot();
  const capabilities = useCapabilities();
  const audio = useAudioEngine();
  const toneRef = useRef<MusicToneHandle | null>(null);
  const [clock, setClock] = useState(0);
  const definition = snapshot.definition;
  const isMemoryBridge = definition?.bridge === "MEMORY_TO_THREAD";
  const elapsed = snapshot.startedAt ? Math.max(0, (clock - snapshot.startedAt) / 1000) : 0;
  const memoryMetrics = getMemoryTransitionMetrics(elapsed, snapshot.status);

  useEffect(() => {
    if (!isMemoryBridge || snapshot.status === "idle") return;
    const tick = () => setClock(Date.now());
    tick();
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [isMemoryBridge, snapshot.status]);

  useEffect(() => {
    if (isMemoryBridge && snapshot.status === "outgoing" && !toneRef.current) {
      if (audio.getSnapshot().isUnlocked) {
        void audio.setMusicState("MEMORIES", {
          gain: FILM_MIX.music.s04,
          gainRampSeconds: 3.4,
          restart: false,
        });
        toneRef.current = audio.applyMusicTone({
          frequency: 1650,
          presence: 0.78,
          rampSeconds: 3.35,
        });
      }
      return;
    }
    if (snapshot.status === "idle" && toneRef.current) {
      toneRef.current.release(0.65);
      toneRef.current = null;
    }
  }, [audio, isMemoryBridge, snapshot.status]);

  useEffect(() => () => {
    toneRef.current?.release(0.05);
    toneRef.current = null;
  }, []);

  useEffect(() => {
    if (snapshot.status !== "revealing" || !definition) return;
    const reduced = capabilities.motionMode === "REDUCED";
    const delay = definition.bridge === "MEMORY_TO_THREAD"
      ? definition.revealDuration * 1000 + 80
      : reduced ? 180 : Math.max(80, definition.revealDuration * 1000 + 80);
    const timer = window.setTimeout(() => runtime.finish(snapshot.sequence), delay);
    return () => window.clearTimeout(timer);
  }, [capabilities.motionMode, definition, runtime, snapshot.sequence, snapshot.status]);

  const hidden = snapshot.status === "idle" || definition?.hardCut || definition?.invisibleBoundary;

  return (
    <div
      className={styles.bridge}
      data-testid="transition-bridge"
      data-transition-state={snapshot.status}
      data-transition-id={definition?.id ?? "IDLE"}
      data-transition-bridge={definition?.bridge ?? "NONE"}
      data-outgoing-run-id={snapshot.outgoingRunId ?? ""}
      data-incoming-run-id={snapshot.incomingRunId ?? ""}
      data-transition-sequence={snapshot.sequence}
      data-transition-mask={definition?.mask ?? "NONE"}
      data-memory-phase={isMemoryBridge ? memoryMetrics.phase : "IDLE"}
      data-final-memory-id={isMemoryBridge ? MEMORY_TO_THREAD.finalMemoryId : ""}
      data-bridge-active={isMemoryBridge && !hidden ? "true" : "false"}
      data-camera-speed={isMemoryBridge ? memoryMetrics.cameraSpeed.toFixed(2) : "0.00"}
      data-remaining-memories={isMemoryBridge ? memoryMetrics.remainingMemoryCount : 0}
      data-thread-opacity={isMemoryBridge ? memoryMetrics.threadOpacity.toFixed(2) : "0.00"}
      data-thread-ownership={isMemoryBridge ? memoryMetrics.threadOwnership : "NONE"}
      data-music-filter={isMemoryBridge ? `${Math.round(memoryMetrics.musicFilterFrequency)}Hz/${memoryMetrics.musicPresence.toFixed(2)}` : "NEUTRAL"}
      data-hidden={hidden ? "true" : "false"}
      aria-hidden="true"
    >
      <span className={styles.field} />
      {isMemoryBridge ? (
        <span className={styles.memoryThreadGroup}>
          <svg className={styles.memoryThread} viewBox="0 0 1000 560" preserveAspectRatio="none">
            <path d="M 520 274 C 556 356, 488 420, 510 520 C 488 420, 556 356, 520 274 S 440 136, 572 18" pathLength="760" />
          </svg>
          <i className={styles.memoryThreadPoint} />
          <i className={`${styles.memoryResidue} ${styles.residueOne}`} />
          <i className={`${styles.memoryResidue} ${styles.residueTwo}`} />
          <i className={`${styles.memoryResidue} ${styles.residueThree}`} />
        </span>
      ) : null}
      <span className={styles.thread} />
      <span className={styles.motif} />
      <span className={styles.motifSecondary} />
      <span className={styles.aperture} />
      <span className={styles.haze} />
      <span className={styles.ring} />
      <span className={styles.ringSecondary} />
      <span className={styles.particles}>
        {PARTICLES.map((index) => <i key={index} style={{ "--particle-index": index } as CSSProperties} />)}
      </span>
    </div>
  );
}
