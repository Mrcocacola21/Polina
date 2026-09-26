"use client";

import { useCapabilities } from "@/lib/accessibility/CapabilityContext";
import { effectiveWebAudio } from "@/lib/accessibility/capabilities";
import { useAudioEngine, useAudioSnapshot } from "@/lib/audio/AudioEngineContext";

import styles from "./MuteControl.module.css";

export function MuteControl() {
  const audio = useAudioEngine();
  const snapshot = useAudioSnapshot();
  const capabilities = useCapabilities();
  const available = effectiveWebAudio(capabilities) && snapshot.contextState !== "unavailable";
  const label = snapshot.isMuted ? "Unmute sound" : "Mute sound";

  const toggle = () => {
    audio.toggleMute();
    if (snapshot.isMuted && snapshot.contextState !== "running") void audio.unlockAudio();
  };

  return (
    <button
      type="button"
      className={styles.control}
      aria-label={available ? label : "Sound unavailable"}
      aria-pressed={snapshot.isMuted}
      disabled={!available}
      onClick={toggle}
      data-testid="global-mute-control"
      title={available ? label : "Sound unavailable"}
    >
      <span aria-hidden="true">{snapshot.isMuted || !available ? "◌" : "◉"}</span>
      <span className={styles.label}>{snapshot.isMuted ? "sound off" : "sound on"}</span>
    </button>
  );
}
