"use client";

import { useEffect, useState } from "react";

import { useCapabilities, useCapabilityActions } from "@/lib/accessibility/CapabilityContext";
import { useAudioEngine, useAudioSnapshot } from "@/lib/audio/AudioEngineContext";
import { AUDIO_PREFERENCE_KEY } from "@/lib/audio/AudioEngine";
import { ANSWER_PERSISTENCE_KEY } from "@/lib/cinematic/phase14";
import { clearRecovery, createRecoveryRecord, persistRecovery, readRecovery } from "@/lib/cinematic/recovery";
import { useMediaDiagnostics } from "@/lib/media/MediaPreloadContext";
import { SOUL_IDS } from "@/lib/souls/registry";
import { useVisualSnapshot } from "@/lib/visuals/VisualRuntimeContext";

import styles from "./FailureLab.module.css";

type OverrideState = Readonly<{
  reducedMotion?: boolean;
  audioUnavailable?: boolean;
  webglUnavailable?: boolean;
  failedMediaKind?: "image" | "video" | "audio" | null;
}>;

export function FailureLab() {
  const capabilities = useCapabilities();
  const { setDevelopmentOverride } = useCapabilityActions();
  const audio = useAudioEngine();
  const audioSnapshot = useAudioSnapshot();
  const visual = useVisualSnapshot();
  const media = useMediaDiagnostics();
  const [override, setOverride] = useState<OverrideState>({});
  const [focused, setFocused] = useState("none");
  const [, setRecoveryRevision] = useState(0);
  const recovery = typeof window === "undefined" ? null : readRecovery(window.sessionStorage);

  useEffect(() => {
    const update = () => setFocused(document.activeElement instanceof HTMLElement
      ? `${document.activeElement.tagName.toLowerCase()}${document.activeElement.getAttribute("aria-label") ? `:${document.activeElement.getAttribute("aria-label")}` : ""}`
      : "none");
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    update();
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, []);

  const apply = (next: OverrideState) => {
    setOverride(next);
    setDevelopmentOverride(next);
  };

  return (
    <aside className={styles.panel} data-testid="failure-lab">
      <strong>PHASE 20 · FAILURE LAB</strong>
      <dl>
        <div><dt>motion</dt><dd>{capabilities.motionMode}</dd></div>
        <div><dt>quality</dt><dd>{visual.quality}</dd></div>
        <div><dt>audio</dt><dd>{capabilities.simulatedAudioUnavailable ? "UNAVAILABLE" : audioSnapshot.contextState}</dd></div>
        <div><dt>mute</dt><dd>{String(audioSnapshot.isMuted)}</dd></div>
        <div><dt>webgl</dt><dd>{capabilities.simulatedWebGLUnavailable ? "UNAVAILABLE" : visual.webgl}</dd></div>
        <div><dt>visibility</dt><dd>{capabilities.visibility}</dd></div>
        <div><dt>focus</dt><dd>{focused}</dd></div>
        <div><dt>recovery</dt><dd>{recovery?.checkpoint ?? "none"}</dd></div>
        <div><dt>fallbacks</dt><dd>{media.failures.length}</dd></div>
      </dl>
      <div className={styles.controls}>
        <button type="button" onClick={() => apply({ ...override, reducedMotion: override.reducedMotion ? undefined : true })}>REDUCED</button>
        <button type="button" onClick={() => audio.toggleMute()}>MUTE</button>
        <button type="button" onClick={() => apply({ ...override, audioUnavailable: !override.audioUnavailable })}>NO AUDIO</button>
        <button type="button" onClick={() => apply({ ...override, webglUnavailable: !override.webglUnavailable })}>NO WEBGL</button>
        <button type="button" onClick={() => apply({ ...override, failedMediaKind: "image" })}>FAIL IMAGE</button>
        <button type="button" onClick={() => apply({ ...override, failedMediaKind: "video" })}>FAIL VIDEO</button>
        <button type="button" onClick={() => apply({ ...override, failedMediaKind: "audio", audioUnavailable: true })}>FAIL AUDIO</button>
        <button type="button" onClick={() => { clearRecovery(window.sessionStorage); setRecoveryRevision((value) => value + 1); }}>CLEAR RECOVERY</button>
        <button type="button" onClick={() => window.localStorage.removeItem(ANSWER_PERSISTENCE_KEY)}>CLEAR ANSWER</button>
        <button type="button" onClick={() => { audio.clearMutePreference(); window.localStorage.removeItem(AUDIO_PREFERENCE_KEY); }}>CLEAR AUDIO PREFS</button>
        <button type="button" onClick={() => { persistRecovery(window.sessionStorage, createRecoveryRecord("PRE_FINAL", SOUL_IDS)); setRecoveryRevision((value) => value + 1); }}>SET PRE_FINAL</button>
        <button type="button" onClick={() => apply({})}>RESET</button>
      </div>
    </aside>
  );
}
