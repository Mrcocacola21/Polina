"use client";

import styles from "./CinematicContinue.module.css";

type CinematicContinueProps = Readonly<{
  visible: boolean;
  nextSceneTitle?: string;
  onContinue: () => void;
}>;

export function CinematicContinue({
  visible,
  nextSceneTitle,
  onContinue,
}: CinematicContinueProps) {
  if (!visible || !nextSceneTitle) {
    return null;
  }

  return (
    <button
      className={styles.button}
      type="button"
      onClick={onContinue}
      aria-label={`Continue to ${nextSceneTitle}`}
      data-testid="cinematic-continue"
    >
      Continue
    </button>
  );
}
