"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useVisualRuntime, useVisualSnapshot } from "@/lib/visuals/VisualRuntimeContext";
import {
  CinematicFractureController,
  type CinematicFracturePreset,
  type ResolvedCinematicFracture,
} from "@/lib/visuals/cinematic-fracture";

import styles from "./FractureLab.module.css";

type PresetName = "S07_TO_S08" | "REQUIEM_BUILDUP" | "REQUIEM_HERO" | "REQUIEM_SECONDARY";
type TriggerName = "MICRO" | "MEDIUM" | "HERO";

const PRESETS: Readonly<Record<PresetName, CinematicFracturePreset>> = Object.freeze({
  S07_TO_S08: Object.freeze({ intensity: .9, sliceAmount: 14, sliceCount: 6, chromaticOffset: 3, verticalShear: 2.5, lumaTear: .16, frameEcho: .12, scanlineWarp: .22, edgeEnergy: .32, duration: 260, seed: 7073, blackTears: 1, radialStretch: .012, protectedBand: [.24, .72] as const, revealAmount: .62 }),
  REQUIEM_BUILDUP: Object.freeze({ intensity: .24, sliceAmount: 4, sliceCount: 2, chromaticOffset: .8, verticalShear: 0, lumaTear: .04, frameEcho: 0, scanlineWarp: .06, edgeEnergy: .06, duration: 72, seed: 1201, blackTears: 0, radialStretch: .004 }),
  REQUIEM_HERO: Object.freeze({ intensity: 1, sliceAmount: 18, sliceCount: 7, chromaticOffset: 3.5, verticalShear: 3, lumaTear: .18, frameEcho: .12, scanlineWarp: .24, edgeEnergy: .36, duration: 196, seed: 1203, blackTears: 2, radialStretch: .026 }),
  REQUIEM_SECONDARY: Object.freeze({ intensity: .66, sliceAmount: 12, sliceCount: 5, chromaticOffset: 2.4, verticalShear: 1.6, lumaTear: .11, frameEcho: .08, scanlineWarp: .16, edgeEnergy: .22, duration: 136, seed: 1204, blackTears: 1, radialStretch: .014 }),
});

const TRIGGER_SCALE: Readonly<Record<TriggerName, number>> = Object.freeze({ MICRO: .32, MEDIUM: .65, HERO: 1 });

type ToggleState = Readonly<{
  slices: boolean;
  chromatic: boolean;
  radial: boolean;
  blackTears: boolean;
  luma: boolean;
  frameEcho: boolean;
  crimsonEdges: boolean;
}>;

const DEFAULT_TOGGLES: ToggleState = Object.freeze({
  slices: true,
  chromatic: true,
  radial: true,
  blackTears: true,
  luma: true,
  frameEcho: true,
  crimsonEdges: true,
});

export function FractureLab() {
  const visual = useVisualRuntime();
  const visualSnapshot = useVisualSnapshot();
  const sourceRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<CinematicFractureController | null>(null);
  const [presetName, setPresetName] = useState<PresetName>("S07_TO_S08");
  const [intensity, setIntensity] = useState(1);
  const [seed, setSeed] = useState(PRESETS.S07_TO_S08.seed);
  const [toggles, setToggles] = useState<ToggleState>(DEFAULT_TOGGLES);
  const [metrics, setMetrics] = useState<ResolvedCinematicFracture | null>(null);

  useEffect(() => () => controllerRef.current?.dispose(), []);

  const trigger = useCallback((triggerName: TriggerName) => {
    if (!sourceRef.current || !hostRef.current) return;
    const base = PRESETS[presetName];
    const scale = TRIGGER_SCALE[triggerName] * intensity;
    const event: CinematicFracturePreset = {
      ...base,
      intensity: Math.min(1, base.intensity * scale),
      sliceAmount: base.sliceAmount * scale,
      sliceCount: toggles.slices ? Math.max(1, Math.round(base.sliceCount * Math.max(.45, scale))) : 0,
      chromaticOffset: toggles.chromatic ? base.chromaticOffset * scale : 0,
      radialStretch: toggles.radial ? base.radialStretch * scale : 0,
      blackTears: toggles.blackTears ? base.blackTears : 0,
      lumaTear: toggles.luma ? base.lumaTear * scale : 0,
      frameEcho: toggles.frameEcho ? base.frameEcho * scale : 0,
      edgeEnergy: toggles.crimsonEdges ? base.edgeEnergy * scale : 0,
      duration: triggerName === "MICRO" ? Math.min(78, base.duration) : triggerName === "MEDIUM" ? Math.min(138, base.duration) : base.duration,
      seed,
    };
    controllerRef.current ??= new CinematicFractureController(sourceRef.current, hostRef.current);
    setMetrics(controllerRef.current.fracture(event, {
      quality: visual.quality,
      motionMode: visual.motionMode,
      mobile: window.matchMedia("(max-width: 760px)").matches,
    }));
  }, [intensity, presetName, seed, toggles, visual]);

  const toggle = (key: keyof ToggleState) => {
    setToggles((current) => ({ ...current, [key]: !current[key] }));
  };

  const reset = () => {
    controllerRef.current?.clear();
    setPresetName("S07_TO_S08");
    setIntensity(1);
    setSeed(PRESETS.S07_TO_S08.seed);
    setToggles(DEFAULT_TOGGLES);
    setMetrics(null);
  };

  return (
    <div className={styles.lab} data-testid="fracture-lab">
      <div ref={sourceRef} className={styles.preview} data-preset={presetName} aria-hidden="true">
        <span className={styles.depth} />
        <span className={`${styles.ring} ${styles.ringA}`} />
        <span className={`${styles.ring} ${styles.ringB}`} />
        <strong>{presetName === "S07_TO_S08" ? "∞" : "REQ"}</strong>
        <i>SOULBOUND · STRUCTURAL SIGNAL</i>
      </div>
      <div ref={hostRef} className={styles.fractureHost} data-cinematic-fracture-host="true" aria-hidden="true" />
      <aside className={styles.panel}>
        <strong>FRACTURE LAB</strong>
        <label>Scene preset
          <select value={presetName} onChange={(event) => {
            const name = event.target.value as PresetName;
            setPresetName(name);
            setSeed(PRESETS[name].seed);
          }}>
            {Object.keys(PRESETS).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label>Intensity {intensity.toFixed(2)}
          <input type="range" min="0" max="1" step="0.05" value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} />
        </label>
        <label>Seed
          <input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value) || 1)} />
        </label>
        <div className={styles.triggers}>
          {(["MICRO", "MEDIUM", "HERO"] as const).map((name) => <button key={name} type="button" onClick={() => trigger(name)}>Trigger {name}</button>)}
        </div>
        <div className={styles.toggles}>
          {(Object.keys(toggles) as Array<keyof ToggleState>).map((key) => (
            <label key={key}><input type="checkbox" checked={toggles[key]} onChange={() => toggle(key)} />{key}</label>
          ))}
        </div>
        <button type="button" onClick={reset}>Reset</button>
        <dl className={styles.metrics}>
          <div><dt>preset</dt><dd>{presetName}</dd></div>
          <div><dt>duration</dt><dd>{metrics?.duration ?? 0} ms</dd></div>
          <div><dt>slices</dt><dd>{metrics?.sliceCount ?? 0}</dd></div>
          <div><dt>max displacement</dt><dd>{(metrics?.sliceAmount ?? 0).toFixed(1)} px</dd></div>
          <div><dt>chromatic</dt><dd>{(metrics?.chromaticOffset ?? 0).toFixed(1)} px</dd></div>
          <div><dt>radial</dt><dd>{(metrics?.radialStretch ?? 0).toFixed(3)}</dd></div>
          <div><dt>luma</dt><dd>{(metrics?.lumaTear ?? 0).toFixed(3)}</dd></div>
          <div><dt>seed</dt><dd>{metrics?.seed ?? seed}</dd></div>
          <div><dt>quality</dt><dd>{visualSnapshot.quality}</dd></div>
          <div><dt>render targets</dt><dd>0</dd></div>
          <div><dt>shader warmed</dt><dd>YES · DOM compositor</dd></div>
        </dl>
      </aside>
    </div>
  );
}
