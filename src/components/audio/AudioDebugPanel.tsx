"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  useAudioEngine,
  useAudioSnapshot,
} from "@/lib/audio/AudioEngineContext";
import {
  AMBIENT_STATES,
  MUSIC_STATES,
} from "@/lib/audio/catalog";
import { createSceneAudioScopeId } from "@/lib/audio/scopes";
import type {
  AmbientHandle,
  AmbientState,
  AudioHandle,
  MusicState,
  PulseHandle,
  VolumeName,
} from "@/lib/audio/types";
import type { SceneId } from "@/lib/cinematic/scenes";
import type { MediaAsset } from "@/lib/media/types";

import styles from "./AudioDebugPanel.module.css";

type AudioDebugPanelProps = Readonly<{
  sceneId: SceneId;
  runId: number;
}>;

const LEVELS: readonly VolumeName[] = [
  "master",
  "music",
  "ambient",
  "sfx",
  "procedural",
];

export function AudioDebugPanel({ sceneId, runId }: AudioDebugPanelProps) {
  const engine = useAudioEngine();
  const snapshot = useAudioSnapshot();
  const [sfxAssets, setSfxAssets] = useState<readonly MediaAsset[]>([]);
  const [selectedSfx, setSelectedSfx] = useState("");
  const [sfxGain, setSfxGain] = useState(0.8);
  const [sfxPan, setSfxPan] = useState(0);
  const [sfxRate, setSfxRate] = useState(1);
  const [crossfade, setCrossfade] = useState(0.8);
  const [scopeTests, setScopeTests] = useState(true);
  const testSfx = useRef<AudioHandle | null>(null);
  const ambient = useRef(new Map<AmbientState, AmbientHandle>());
  const continuous = useRef(new Map<string, AudioHandle>());
  const pulse = useRef<PulseHandle | null>(null);
  const scopeId = useMemo(
    () => (scopeTests ? createSceneAudioScopeId(sceneId, runId) : undefined),
    [runId, sceneId, scopeTests],
  );

  useEffect(() => {
    let active = true;
    void engine.getCatalog().then(
      (catalog) => {
        if (!active) return;
        const assets = catalog.getShortSfx();
        setSfxAssets(assets);
        setSelectedSfx((current) => current || assets[0]?.id || "");
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [engine]);

  async function playMusic(state: MusicState) {
    await engine.setMusicState(state, { crossfadeSeconds: crossfade });
  }

  async function playSelectedSfx() {
    if (!selectedSfx) return;
    testSfx.current = await engine.playSfx(selectedSfx, {
      gain: sfxGain,
      pan: sfxPan,
      playbackRate: sfxRate,
      scopeId,
    });
  }

  async function toggleAmbient(state: AmbientState) {
    const current = ambient.current.get(state);
    if (current?.isActive()) {
      current.stop({ fadeSeconds: 0.25 });
      ambient.current.delete(state);
      return;
    }
    const handle = await engine.playAmbient(state, {
      fadeInSeconds: 0.2,
      scopeId,
    });
    if (handle) ambient.current.set(state, handle);
  }

  function toggleContinuous(name: string) {
    const current = continuous.current.get(name);
    if (current?.isActive()) {
      current.stop({ fadeSeconds: 0.1 });
      continuous.current.delete(name);
      return;
    }
    const handle =
      name === "rumble"
        ? engine.createLowRumble({ scopeId })
        : name === "noise"
          ? engine.createFilteredNoise({ scopeId })
          : engine.createSoulHum({ scopeId });
    if (handle) continuous.current.set(name, handle);
  }

  function triggerPulse() {
    if (!pulse.current?.isActive()) {
      pulse.current = engine.createPulse(scopeId);
    }
    pulse.current?.triggerPulse();
  }

  return (
    <aside className={styles.panel} data-testid="audio-debug-panel">
      <div className={styles.heading}>
        <strong>AUDIO ENGINE</strong>
        <button
          type="button"
          data-testid="audio-unlock"
          onClick={() => void engine.unlockAudio()}
        >
          Unlock Audio
        </button>
        <button type="button" onClick={() => engine.toggleMute()}>
          {snapshot.isMuted ? "Unmute" : "Mute"}
        </button>
      </div>

      <dl className={styles.status}>
        <div><dt>context</dt><dd data-testid="audio-context-state">{snapshot.contextState}</dd></div>
        <div><dt>contexts</dt><dd>{snapshot.contextCreationCount}</dd></div>
        <div><dt>music</dt><dd data-testid="audio-music-state">{snapshot.music.state ?? "none"} / {snapshot.music.deck ?? "—"} / decks {snapshot.activeMusicDeckCount}</dd></div>
        <div><dt>time</dt><dd data-testid="audio-music-time">{snapshot.music.currentTime.toFixed(1)} / {snapshot.music.duration?.toFixed(1) ?? "?"}</dd></div>
        <div><dt>active</dt><dd data-testid="audio-active-counts">A {snapshot.activeAmbientCount} · S {snapshot.activeSfxCount} · P {snapshot.activeProceduralCount}</dd></div>
        <div><dt>scope/duck</dt><dd>{snapshot.activeScopeCount} / {snapshot.activeDuckCount}</dd></div>
        <div><dt>music duck</dt><dd data-testid="audio-music-duck">{snapshot.effectiveDucks.music.toFixed(2)}</dd></div>
        <div><dt>decoded</dt><dd data-testid="audio-decoded-count">{snapshot.decodedSfxCount}</dd></div>
      </dl>

      <div className={styles.levels}>
        {LEVELS.map((name) => (
          <label key={name}>
            <span>{name} {snapshot.levels[name].toFixed(2)}</span>
            <input
              aria-label={`${name} volume`}
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={snapshot.levels[name]}
              onChange={(event) => engine.setVolume(name, Number(event.target.value))}
            />
          </label>
        ))}
      </div>

      <section>
        <h2>Music</h2>
        <label className={styles.inline}>
          Crossfade
          <input
            aria-label="Crossfade seconds"
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={crossfade}
            onChange={(event) => setCrossfade(Number(event.target.value))}
          />
        </label>
        <div className={styles.controls}>
          {MUSIC_STATES.map((state) => (
            <button key={state} type="button" onClick={() => void playMusic(state)}>
              {state}
            </button>
          ))}
          <button type="button" onClick={() => engine.pauseMusic()}>Pause</button>
          <button type="button" onClick={() => void engine.resumeMusic()}>Resume</button>
          <button type="button" onClick={() => engine.stopMusic({ fadeSeconds: crossfade })}>Stop music</button>
        </div>
      </section>

      <section>
        <h2>SFX</h2>
        <select
          aria-label="SFX asset"
          value={selectedSfx}
          onChange={(event) => setSelectedSfx(event.target.value)}
        >
          {sfxAssets.map((asset) => (
            <option key={asset.id} value={asset.id}>{asset.relativePath}</option>
          ))}
        </select>
        <div className={styles.triplet}>
          <label>gain<input aria-label="SFX gain" type="number" min="0" max="2" step="0.1" value={sfxGain} onChange={(event) => setSfxGain(Number(event.target.value))} /></label>
          <label>pan<input aria-label="SFX pan" type="number" min="-1" max="1" step="0.1" value={sfxPan} onChange={(event) => setSfxPan(Number(event.target.value))} /></label>
          <label>rate<input aria-label="SFX rate" type="number" min="0.5" max="2" step="0.1" value={sfxRate} onChange={(event) => setSfxRate(Number(event.target.value))} /></label>
        </div>
        <div className={styles.controls}>
          <button type="button" onClick={() => void playSelectedSfx()}>Play SFX</button>
          <button type="button" onClick={() => testSfx.current?.stop()}>Stop test SFX</button>
          {(["A", "B", "C"] as const).map((voice) => (
            <button key={voice} type="button" onClick={() => void engine.playVoiceLine(voice, { scopeId })}>Voice {voice}</button>
          ))}
          <button type="button" onClick={() => void engine.playRequiem({ scopeId })}>Requiem</button>
          <button type="button" onClick={() => engine.clearDecodedSfxCache()}>Clear cache</button>
          <button type="button" onClick={() => void engine.playSfx("media:invalid")}>Invalid asset</button>
        </div>
      </section>

      <section>
        <h2>Ambient</h2>
        <div className={styles.controls}>
          {AMBIENT_STATES.map((state) => (
            <button key={state} type="button" onClick={() => void toggleAmbient(state)}>{state}</button>
          ))}
          <button type="button" onClick={() => engine.stopAllAmbient({ fadeSeconds: 0.2 })}>Stop all ambient</button>
        </div>
      </section>

      <section>
        <h2>Ducking / Procedural</h2>
        <div className={styles.controls}>
          <button type="button" onClick={() => engine.duckBus("music")}>Duck music</button>
          <button type="button" onClick={() => {
            engine.duckBus("music", { to: 0.5, holdSeconds: 1.5 });
            engine.duckBus("music", { to: 0.2, holdSeconds: 0.7 });
          }}>Overlap ducks</button>
          <button type="button" onClick={() => toggleContinuous("rumble")}>Low rumble</button>
          <button type="button" onClick={triggerPulse}>Heartbeat pulse</button>
          <button type="button" onClick={() => toggleContinuous("noise")}>Filtered noise</button>
          <button type="button" onClick={() => engine.playUiTone({ scopeId })}>UI tone</button>
          <button type="button" onClick={() => engine.startRatingRise({ scopeId })}>Rating rise</button>
          <button type="button" onClick={() => toggleContinuous("hum")}>Soul hum</button>
          <button type="button" onClick={() => engine.stopAllProcedural()}>Stop procedural</button>
        </div>
      </section>

      <label className={styles.scopeToggle}>
        <input
          type="checkbox"
          checked={scopeTests}
          onChange={(event) => setScopeTests(event.target.checked)}
        />
        Bind tests to {sceneId}#run-{runId}
      </label>
      {snapshot.lastError ? <p className={styles.error}>{snapshot.lastError}</p> : null}
    </aside>
  );
}
