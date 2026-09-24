"use client";

import gsap from "gsap";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAudioEngine, useSceneAudio } from "@/lib/audio/AudioEngineContext";
import type { MusicToneHandle } from "@/lib/audio/types";
import {
  PHASE11_MUSIC_STATE,
  PRE_FINAL_COPY,
  PRE_FINAL_TIMING,
  S10_AUDIO_LEVELS,
} from "@/lib/cinematic/phase11";
import { useSceneRuntime } from "@/lib/cinematic/SceneRuntimeContext";
import { useSoulCollectionRuntime } from "@/lib/souls/SoulCollectionContext";
import { useVisualRuntime } from "@/lib/visuals/VisualRuntimeContext";
import { createSceneVisualScopeId } from "@/lib/visuals/VisualScope";

import styles from "./PreFinalScene.module.css";

export function PreFinalScene() {
  const rootRef = useRef<HTMLElement>(null);
  const lineRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const toneRef = useRef<MusicToneHandle | null>(null);
  const timelineStartedRef = useRef(false);
  const [sceneBeat, setSceneBeat] = useState("black");
  const { phase, runId, completeEnter, completeExit, setCanAdvance, setContinueVisible } = useSceneRuntime();
  const audio = useAudioEngine();
  const sceneAudio = useSceneAudio();
  const collectionRuntime = useSoulCollectionRuntime();
  const visual = useVisualRuntime();
  const scopeId = createSceneVisualScopeId("PRE_FINAL", runId);

  const applyPreFinalTone = useCallback(() => {
    if (!audio.getSnapshot().isUnlocked) return;
    toneRef.current = sceneAudio.applyMusicTone({
      ...S10_AUDIO_LEVELS.tone.preFinal,
      rampSeconds: 2.2,
    });
  }, [audio, sceneAudio]);

  useEffect(() => {
    collectionRuntime.dimHud();
    visual.setCursorMode("HIDDEN");
    visual.setFog(null, 0, 0.2);
    visual.setLightLeak(0, { drift: false });
    visual.setGrain(0.012);
    visual.setVignette(0.64, 0.94);
    visual.setVignetteCenter(50, 50);
    return () => {
      toneRef.current?.release(0.2);
      toneRef.current = null;
      collectionRuntime.showHud();
      visual.setCursorMode("DEFAULT");
      visual.setFog(null, 0, 0.1);
      visual.setLightLeak(0, { drift: false });
      visual.setGrain(0.055);
      visual.setVignette(0.42, 0.62);
      visual.setVignetteCenter(50, 50);
    };
  }, [collectionRuntime, visual]);

  useEffect(() => {
    if (phase !== "entering") return;
    if (audio.getSnapshot().isUnlocked && audio.getSnapshot().music.state !== PHASE11_MUSIC_STATE) {
      void audio.crossfadeMusic(PHASE11_MUSIC_STATE, { crossfadeSeconds: PRE_FINAL_TIMING.directMusicCrossfade });
    }
    applyPreFinalTone();
    const timeline = gsap.timeline({ onComplete: completeEnter });
    timeline.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: PRE_FINAL_TIMING.entryReveal, ease: "sine.out" });
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [applyPreFinalTone, audio, completeEnter, phase, scopeId, visual]);

  useEffect(() => {
    if (phase !== "active" || timelineStartedRef.current) return;
    timelineStartedRef.current = true;
    const lines = lineRefs.current;
    const timeline = gsap.timeline();
    timeline.call(() => setSceneBeat("first"), [], PRE_FINAL_TIMING.first);
    timeline.fromTo(lines[0], { opacity: 0, filter: "blur(5px)", y: 7 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 1.25, ease: "sine.out" }, PRE_FINAL_TIMING.first);
    timeline.call(() => setSceneBeat("second"), [], PRE_FINAL_TIMING.second);
    timeline.fromTo(lines[1], { opacity: 0, filter: "blur(4px)", y: 6 }, { opacity: 0.9, filter: "blur(0px)", y: 0, duration: 1.15, ease: "sine.out" }, PRE_FINAL_TIMING.second);
    timeline.call(() => setSceneBeat("third"), [], PRE_FINAL_TIMING.third);
    timeline.fromTo(lines[2], { opacity: 0, filter: "blur(4px)", y: 6 }, { opacity: 0.84, filter: "blur(0px)", y: 0, duration: 1.2, ease: "sine.out" }, PRE_FINAL_TIMING.third);
    timeline.call(() => setSceneBeat("long-pause"), [], PRE_FINAL_TIMING.third + 1.25);
    timeline.call(() => setSceneBeat("final"), [], PRE_FINAL_TIMING.final);
    timeline.to(lines.slice(0, 3), { opacity: 0, filter: "blur(1.5px)", duration: 1.1, ease: "sine.inOut" }, PRE_FINAL_TIMING.final - 0.55);
    timeline.fromTo(lines[3], { opacity: 0, filter: "blur(4px)", y: 5 }, { opacity: 1, filter: "blur(0px)", y: 0, duration: 1.35, ease: "sine.out" }, PRE_FINAL_TIMING.final);
    timeline.call(() => {
      setSceneBeat("complete");
      visual.setCursorMode("DIMMED");
      setCanAdvance(true);
      setContinueVisible(true);
    }, [], PRE_FINAL_TIMING.continue);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [phase, scopeId, setCanAdvance, setContinueVisible, visual]);

  useEffect(() => {
    if (phase !== "exiting") return;
    visual.setCursorMode("HIDDEN");
    const timeline = gsap.timeline({ onComplete: completeExit });
    timeline.to(lineRefs.current, { opacity: 0, filter: "blur(2px)", duration: 0.8, ease: "sine.in" });
    timeline.to(rootRef.current, { opacity: 0, duration: PRE_FINAL_TIMING.exit, ease: "sine.inOut" }, 0);
    return visual.addScopeCleanup(scopeId, () => timeline.kill());
  }, [completeExit, phase, scopeId, visual]);

  return (
    <section
      ref={rootRef}
      className={styles.scene}
      data-testid="pre-final-scene"
      data-scene-phase={phase}
      data-scene-beat={sceneBeat}
      data-music-state={PHASE11_MUSIC_STATE}
      data-procedural-audio="none"
      aria-label="Vulnerability"
    >
      <p className={styles.copy} aria-label={PRE_FINAL_COPY.full}>
        {PRE_FINAL_COPY.segments.map((segment, index) => (
          <span
            key={segment}
            ref={(element) => { lineRefs.current[index] = element; }}
            className={`${styles.line} ${index === 3 ? styles.finalLine : ""}`}
            aria-hidden="true"
          >
            {segment}
          </span>
        ))}
      </p>
    </section>
  );
}
