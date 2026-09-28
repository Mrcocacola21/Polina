"use client";

import { useEffect, useState } from "react";

import { useAudioSnapshot } from "@/lib/audio/AudioEngineContext";
import type { CinematicState } from "@/lib/cinematic/types";
import { useTransitionSnapshot } from "@/lib/cinematic/TransitionRuntimeContext";
import {
  TRANSITION_DEFINITIONS,
  type TransitionDefinition,
} from "@/lib/cinematic/transitions";
import { useSoulCollectionSnapshot } from "@/lib/souls/SoulCollectionContext";
import { useVisualSnapshot } from "@/lib/visuals/VisualRuntimeContext";

import styles from "./TransitionLab.module.css";

type TransitionLabProps = Readonly<{
  state: CinematicState;
  onRun: (definition: TransitionDefinition) => void;
  onReset: (definition: TransitionDefinition) => void;
}>;

export function TransitionLab({ state, onRun, onReset }: TransitionLabProps) {
  const [selectedId, setSelectedId] = useState("S03_S04");
  const [elapsed, setElapsed] = useState(0);
  const [videos, setVideos] = useState(0);
  const [memoryMetrics, setMemoryMetrics] = useState({
    phase: "IDLE",
    finalMemoryId: "—",
    bridgeActive: "false",
    cameraSpeed: "0.00",
    remainingMemories: "0",
    threadOpacity: "0.00",
    threadOwnership: "NONE",
    musicFilter: "NEUTRAL",
  });
  const transition = useTransitionSnapshot();
  const visual = useVisualSnapshot();
  const audio = useAudioSnapshot();
  const souls = useSoulCollectionSnapshot();
  const selected = TRANSITION_DEFINITIONS.find((item) => item.id === selectedId) ?? TRANSITION_DEFINITIONS[0];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed(transition.startedAt ? Math.max(0, (Date.now() - transition.startedAt) / 1000) : 0);
      setVideos([...document.querySelectorAll("video")].filter((video) => !video.paused).length);
      const bridge = document.querySelector<HTMLElement>('[data-testid="transition-bridge"]');
      setMemoryMetrics({
        phase: bridge?.dataset.memoryPhase ?? "IDLE",
        finalMemoryId: bridge?.dataset.finalMemoryId || "—",
        bridgeActive: bridge?.dataset.bridgeActive ?? "false",
        cameraSpeed: bridge?.dataset.cameraSpeed ?? "0.00",
        remainingMemories: bridge?.dataset.remainingMemories ?? "0",
        threadOpacity: bridge?.dataset.threadOpacity ?? "0.00",
        threadOwnership: bridge?.dataset.threadOwnership ?? "NONE",
        musicFilter: bridge?.dataset.musicFilter ?? "NEUTRAL",
      });
    }, 200);
    return () => window.clearInterval(timer);
  }, [transition.startedAt]);

  return (
    <aside className={styles.panel} data-testid="transition-lab">
      <strong>TRANSITION LAB</strong>
      <label className={styles.selector} htmlFor="transition-lab-pair">
        Pair
        <select
          id="transition-lab-pair"
          data-testid="transition-lab-pair"
          value={selected.id}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {TRANSITION_DEFINITIONS.map((item) => (
            <option key={item.id} value={item.id}>{item.from} → {item.to}</option>
          ))}
        </select>
      </label>
      <div className={styles.controls}>
        <button type="button" data-testid="transition-lab-run" onClick={() => onRun(selected)}>Start</button>
        <button type="button" data-testid="transition-lab-reset" onClick={() => onReset(selected)}>Reset</button>
      </div>
      <dl className={styles.metrics}>
        <div><dt>from → to</dt><dd>{transition.definition ? `${transition.definition.from} → ${transition.definition.to}` : `${selected.from} → ${selected.to}`}</dd></div>
        <div><dt>runIds</dt><dd>{transition.outgoingRunId ?? "—"} → {transition.incomingRunId ?? "—"}</dd></div>
        <div><dt>state</dt><dd data-testid="transition-lab-state">{transition.status}</dd></div>
        <div><dt>elapsed</dt><dd>{elapsed.toFixed(2)}s</dd></div>
        <div><dt>scene</dt><dd>{state.currentSceneId} / {state.phase}</dd></div>
        <div><dt>fog</dt><dd>{visual.fog ?? "NONE"}</dd></div>
        <div><dt>music</dt><dd>{audio.music.state ?? "NONE"} / decks {audio.activeMusicDeckCount}</dd></div>
        <div><dt>ambients</dt><dd>{audio.activeAmbientCount}</dd></div>
        <div><dt>videos</dt><dd>{videos}</dd></div>
        <div><dt>particles</dt><dd>{visual.particles} / {visual.particleSystems} fields</dd></div>
        <div><dt>cursor</dt><dd>{visual.cursor}</dd></div>
        <div><dt>HUD</dt><dd>{souls.hudMode} / {souls.count}</dd></div>
        <div><dt>camera</dt><dd>identity (persistent R3F)</dd></div>
        <div><dt>mask</dt><dd>{visual.transition}</dd></div>
        {selected.id === "S03_S04" || transition.definition?.id === "S03_S04" ? <>
          <div><dt>phase</dt><dd data-testid="memory-transition-phase">{memoryMetrics.phase}</dd></div>
          <div><dt>final memory</dt><dd>{memoryMetrics.finalMemoryId}</dd></div>
          <div><dt>bridge active</dt><dd>{memoryMetrics.bridgeActive}</dd></div>
          <div><dt>camera speed</dt><dd>{memoryMetrics.cameraSpeed}</dd></div>
          <div><dt>memories left</dt><dd>{memoryMetrics.remainingMemories}</dd></div>
          <div><dt>thread alpha</dt><dd>{memoryMetrics.threadOpacity}</dd></div>
          <div><dt>thread owner</dt><dd>{memoryMetrics.threadOwnership}</dd></div>
          <div><dt>music filter</dt><dd>{memoryMetrics.musicFilter}</dd></div>
        </> : null}
      </dl>
    </aside>
  );
}
