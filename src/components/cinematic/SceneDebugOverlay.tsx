"use client";

import { useState } from "react";

import {
  getNextScene,
  getPreviousScene,
  getSceneIndex,
  isSceneId,
  SCENE_COUNT,
  SCENE_REGISTRY,
  type SceneDefinition,
  type SceneId,
} from "@/lib/cinematic/scenes";
import type { CinematicState } from "@/lib/cinematic/types";

import styles from "./SceneDebugOverlay.module.css";

type SceneDebugOverlayProps = Readonly<{
  state: CinematicState;
  currentScene: SceneDefinition;
  onJump: (sceneId: SceneId) => void;
  onRestart: () => void;
}>;

export function SceneDebugOverlay({
  state,
  currentScene,
  onJump,
  onRestart,
}: SceneDebugOverlayProps) {
  const [selectedSceneId, setSelectedSceneId] = useState<SceneId>(
    currentScene.id,
  );
  const previousScene = getPreviousScene(currentScene.id);
  const nextScene = getNextScene(currentScene.id);
  const transitionLocked = state.phase !== "active" || !state.canAdvance;

  function handleSelection(value: string) {
    if (isSceneId(value)) {
      setSelectedSceneId(value);
    }
  }

  return (
    <aside className={styles.panel} data-testid="scene-debug-overlay">
      <strong>SCENE DIRECTOR</strong>
      <dl className={styles.state}>
        <div>
          <dt>scene</dt>
          <dd data-testid="debug-scene-id">{currentScene.id}</dd>
        </div>
        <div>
          <dt>title</dt>
          <dd>{currentScene.title}</dd>
        </div>
        <div>
          <dt>index</dt>
          <dd>{getSceneIndex(currentScene.id)}</dd>
        </div>
        <div>
          <dt>total scenes</dt>
          <dd>{SCENE_COUNT}</dd>
        </div>
        <div>
          <dt>phase</dt>
          <dd data-testid="debug-phase">{state.phase}</dd>
        </div>
        <div>
          <dt>runId</dt>
          <dd data-testid="debug-run-id">{state.runId}</dd>
        </div>
        <div>
          <dt>canAdvance</dt>
          <dd>{String(state.canAdvance)}</dd>
        </div>
        <div>
          <dt>continueVisible</dt>
          <dd>{String(state.continueVisible)}</dd>
        </div>
        <div>
          <dt>transition locked</dt>
          <dd>{String(transitionLocked)}</dd>
        </div>
        <div>
          <dt>previous</dt>
          <dd>{previousScene?.id ?? "—"}</dd>
        </div>
        <div>
          <dt>next</dt>
          <dd>{nextScene?.id ?? "—"}</dd>
        </div>
      </dl>

      <div className={styles.jumpRow}>
        <label htmlFor="scene-debug-select">Scene</label>
        <select
          id="scene-debug-select"
          value={selectedSceneId}
          onChange={(event) => handleSelection(event.target.value)}
        >
          {SCENE_REGISTRY.map((scene) => (
            <option key={scene.id} value={scene.id}>
              {scene.id} — {scene.title}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => onJump(selectedSceneId)}>
          Jump
        </button>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          onClick={() => previousScene && onJump(previousScene.id)}
          disabled={!previousScene}
        >
          Previous scene
        </button>
        <button type="button" onClick={onRestart}>
          Restart current
        </button>
        <button
          type="button"
          onClick={() => nextScene && onJump(nextScene.id)}
          disabled={!nextScene}
        >
          Next scene
        </button>
      </div>
    </aside>
  );
}
