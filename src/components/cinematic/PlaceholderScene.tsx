"use client";

import { useEffect } from "react";

import {
  getNextScene,
  getSceneIndex,
  SCENE_COUNT,
  type SceneDefinition,
} from "@/lib/cinematic/scenes";
import { useSceneRuntime } from "@/lib/cinematic/SceneRuntimeContext";
import { usePreloadGroup } from "@/lib/media/MediaPreloadContext";

import styles from "./PlaceholderScene.module.css";

type PlaceholderSceneProps = Readonly<{
  scene: SceneDefinition;
}>;

export function PlaceholderScene({ scene }: PlaceholderSceneProps) {
  const {
    phase,
    completeEnter,
    completeExit,
    setCanAdvance,
    setContinueVisible,
  } = useSceneRuntime();
  const hasNextScene = Boolean(getNextScene(scene.id));
  const sceneIndex = getSceneIndex(scene.id);
  const bootProgress = usePreloadGroup("BOOT_CRITICAL");
  const bootSettled =
    bootProgress.state === "ready" ||
    bootProgress.state === "ready-with-errors";

  useEffect(() => {
    if (phase === "active") {
      const progressionReady =
        scene.id === "PRELOADER" ? bootSettled : hasNextScene;
      setCanAdvance(progressionReady && hasNextScene);
      setContinueVisible(progressionReady && hasNextScene);
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      if (phase === "entering") {
        completeEnter();
      } else if (phase === "exiting") {
        completeExit();
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    completeEnter,
    completeExit,
    bootSettled,
    hasNextScene,
    phase,
    scene.id,
    setCanAdvance,
    setContinueVisible,
  ]);

  return (
    <section
      className={styles.scene}
      data-testid="placeholder-scene"
      data-scene-id={scene.id}
      data-scene-phase={phase}
      aria-labelledby="scene-title"
    >
      <div className={styles.content}>
        <p className={styles.brand}>SOULBOUND</p>
        <p className={styles.position}>
          {String(sceneIndex).padStart(2, "0")} / {SCENE_COUNT - 1}
        </p>
        <h1 id="scene-title" className={styles.sceneId}>
          {scene.id}
        </h1>
        <p className={styles.title}>{scene.title}</p>
        <p className={styles.phase}>{phase}</p>
        {scene.id === "PRELOADER" ? (
          <div className={styles.loading} data-testid="boot-preload-progress">
            <span>
              {bootSettled
                ? bootProgress.failed > 0
                  ? "Ready with degraded media"
                  : "Ready"
                : "Loading..."}
            </span>
            <span>{Math.round(bootProgress.percentage)}%</span>
          </div>
        ) : null}
        {scene.id === "FINAL" && phase === "active" ? (
          <p className={styles.end}>Phase 4 visual runtime complete.</p>
        ) : null}
      </div>
    </section>
  );
}
