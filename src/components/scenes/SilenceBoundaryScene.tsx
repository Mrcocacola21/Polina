"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";

import { useAudioEngine } from "@/lib/audio/AudioEngineContext";
import { SILENCE_LINES, SILENCE_TIMING } from "@/lib/cinematic/phase13";
import { useSceneRuntime } from "@/lib/cinematic/SceneRuntimeContext";
import { useSoulCollectionRuntime } from "@/lib/souls/SoulCollectionContext";
import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";
import { createSceneVisualScopeId } from "@/lib/visuals/VisualScope";

import styles from "./SilenceBoundaryScene.module.css";

export function SilenceBoundaryScene() {
  const rootRef = useRef<HTMLElement>(null);
  const lineRefs = useRef<Array<HTMLParagraphElement | null>>([]);
  const timelineStartedRef = useRef(false);
  const [beat, setBeat] = useState("initial-black");
  const { phase, runId, completeEnter, completeExit, setCanAdvance, requestAdvance } = useSceneRuntime();
  const audio = useAudioEngine();
  const collection = useSoulCollectionRuntime();
  const visual = useVisualRuntime();
  const scopeId = createSceneVisualScopeId("SILENCE", runId);

  useEffect(() => {
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
    if (rootRef.current) rootRef.current.style.opacity = "1";
  }, [audio, collection, visual]);

  useEffect(() => {
    if (phase === "entering") completeEnter();
  }, [completeEnter, phase]);

  useEffect(() => {
    if (phase !== "active" || timelineStartedRef.current) return;
    timelineStartedRef.current = true;
    const timeline = gsap.timeline();

    timeline.call(() => {
      visual.leaveAbsoluteBlack();
      setBeat("line-1");
    }, [], SILENCE_TIMING.initialBlack);

    SILENCE_TIMING.cues.forEach((cue, index) => {
      const line = lineRefs.current[index];
      timeline.call(() => setBeat(`line-${index + 1}`), [], cue.revealAt);
      timeline.fromTo(
        line,
        { opacity: 0, filter: "blur(3px)", y: 4 },
        {
          opacity: 1,
          filter: "blur(0px)",
          y: 0,
          duration: SILENCE_TIMING.lineFadeIn,
          ease: "sine.out",
        },
        cue.revealAt,
      );
      timeline.to(
        line,
        {
          opacity: 0,
          filter: "blur(2px)",
          y: -3,
          duration: SILENCE_TIMING.lineFadeOut,
          ease: "sine.in",
        },
        cue.hideAt,
      );
    });

    timeline.call(() => setBeat("handoff-black"), [], SILENCE_TIMING.cues.at(-1)?.hideAt ?? 14.88);
    timeline.call(() => {
      setBeat("complete");
      setCanAdvance(true);
      queueMicrotask(requestAdvance);
    }, [], SILENCE_TIMING.handoffAt);

    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [phase, requestAdvance, scopeId, setCanAdvance, visual]);

  useEffect(() => {
    if (phase === "exiting") completeExit();
  }, [completeExit, phase]);

  return (
    <section
      ref={rootRef}
      className={styles.scene}
      data-testid="silence-scene"
      data-scene-beat={beat}
      data-audio-gated="true"
      aria-label="Silence"
    >
      <div className={styles.copy} aria-live="off">
        {SILENCE_LINES.map((line, index) => (
          <p
            key={line}
            ref={(element) => { lineRefs.current[index] = element; }}
            className={styles.line}
          >
            {line}
          </p>
        ))}
      </div>
    </section>
  );
}
