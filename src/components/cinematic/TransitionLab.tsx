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
  const [selectedId, setSelectedId] = useState(TRANSITION_DEFINITIONS[0].id);
  const [elapsed, setElapsed] = useState(0);
  const [videos, setVideos] = useState(0);
  const transition = useTransitionSnapshot();
  const visual = useVisualSnapshot();
  const audio = useAudioSnapshot();
  const souls = useSoulCollectionSnapshot();
  const selected = TRANSITION_DEFINITIONS.find((item) => item.id === selectedId) ?? TRANSITION_DEFINITIONS[0];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setElapsed(transition.startedAt ? Math.max(0, (Date.now() - transition.startedAt) / 1000) : 0);
      setVideos([...document.querySelectorAll("video")].filter((video) => !video.paused).length);
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
        <button type="button" data-testid="transition-lab-run" onClick={() => onRun(selected)}>Run</button>
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
      </dl>
    </aside>
  );
}
