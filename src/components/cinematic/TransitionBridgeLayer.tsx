"use client";

import { useEffect, type CSSProperties } from "react";

import { useTransitionRuntime, useTransitionSnapshot } from "@/lib/cinematic/TransitionRuntimeContext";
import { useMediaAsset } from "@/lib/media/MediaPreloadContext";

import styles from "./TransitionBridgeLayer.module.css";

const PARTICLES = Array.from({ length: 14 }, (_, index) => index);

export function TransitionBridgeLayer() {
  const runtime = useTransitionRuntime();
  const snapshot = useTransitionSnapshot();
  const definition = snapshot.definition;
  const memoryOne = useMediaAsset("visual:screens.together");
  const memoryTwo = useMediaAsset("visual:screens.minecraftTogether");
  const memoryThree = useMediaAsset("visual:screens.livingTogether");

  useEffect(() => {
    if (snapshot.status !== "revealing" || !definition) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduced ? 180 : Math.max(80, definition.revealDuration * 1000 + 80);
    const timer = window.setTimeout(() => runtime.finish(snapshot.sequence), delay);
    return () => window.clearTimeout(timer);
  }, [definition, runtime, snapshot.sequence, snapshot.status]);

  const hidden = snapshot.status === "idle" || definition?.hardCut || definition?.invisibleBoundary;
  const showMemories = definition?.bridge === "MEMORY_TO_THREAD";

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
      data-hidden={hidden ? "true" : "false"}
      aria-hidden="true"
    >
      <span className={styles.field} />
      {showMemories ? <>
        <span className={`${styles.memory} ${styles.memoryOne}`} style={{ "--memory-image": `url(${memoryOne?.url ?? ""})` } as CSSProperties} />
        <span className={`${styles.memory} ${styles.memoryTwo}`} style={{ "--memory-image": `url(${memoryTwo?.url ?? ""})` } as CSSProperties} />
        <span className={`${styles.memory} ${styles.memoryThree}`} style={{ "--memory-image": `url(${memoryThree?.url ?? ""})` } as CSSProperties} />
      </> : null}
      <span className={styles.thread} />
      <span className={styles.motif} />
      <span className={styles.motifSecondary} />
      <span className={styles.aperture} />
      <span className={styles.haze} />
      <span className={styles.ring} />
      <span className={styles.ringSecondary} />
      <span className={styles.fracture} />
      <span className={styles.particles}>
        {PARTICLES.map((index) => <i key={index} style={{ "--particle-index": index } as CSSProperties} />)}
      </span>
    </div>
  );
}
