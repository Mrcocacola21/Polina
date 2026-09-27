"use client";

import { useRef, useState } from "react";

import {
  useAudioEngine,
  useAudioSnapshot,
} from "@/lib/audio/AudioEngineContext";
import { getSoulDefinition, SOUL_IDS, type SoulId } from "@/lib/souls/registry";
import {
  useSoulCollectionRuntime,
  useSoulCollectionSnapshot,
} from "@/lib/souls/SoulCollectionContext";
import type {
  CollectionResult,
  CollectionVariant,
  ReleaseResult,
  SoulVoice,
} from "@/lib/souls/types";
import type { SoulState } from "@/lib/visuals/types";
import { useVisualSnapshot } from "@/lib/visuals/VisualRuntimeContext";

import styles from "./SoulCollectionSandbox.module.css";

const VARIANTS: readonly CollectionVariant[] = ["NORMAL", "SILENT", "DEEP"];
const VOICES: readonly SoulVoice[] = ["NONE", "A", "B", "C"];
const VISUAL_STATES: readonly SoulState[] = ["DORMANT", "ACTIVE", "CHARGED"];

export function SoulCollectionSandbox() {
  const runtime = useSoulCollectionRuntime();
  const snapshot = useSoulCollectionSnapshot();
  const audio = useAudioEngine();
  const audioSnapshot = useAudioSnapshot();
  const visualSnapshot = useVisualSnapshot();
  const sourceRef = useRef<HTMLHeadingElement>(null);
  const [soulId, setSoulId] = useState<SoulId>("SOUL_01");
  const [variant, setVariant] = useState<CollectionVariant>("NORMAL");
  const [voice, setVoice] = useState<SoulVoice>("NONE");
  const [visualState, setVisualState] = useState<SoulState>("ACTIVE");
  const [lastResult, setLastResult] = useState("none");
  const definition = getSoulDefinition(soulId);
  const currentOwner = runtime.getCurrentSceneOwner();
  const boundOwner = currentOwner?.sceneId === definition.sceneId
    ? currentOwner
    : undefined;

  async function collectFromText() {
    const element = sourceRef.current;
    if (!element) return;
    const result = await runtime.collectSoul({
      soulId,
      source: { type: "TEXT", element },
      variant,
      debugVoice: voice,
      visualState,
      restoreSourceAfterCollection: true,
      timingScale: 0.45,
      owner: boundOwner,
    });
    setLastResult(formatResult(result));
  }

  async function collectFromPoint() {
    const result = await runtime.collectSoul({
      soulId,
      source: {
        type: "POINT",
        point: [window.innerWidth * 0.42, window.innerHeight * 0.56],
      },
      variant,
      debugVoice: voice,
      visualState,
      timingScale: 0.45,
      owner: boundOwner,
    });
    setLastResult(formatResult(result));
  }

  function formatResult(result: CollectionResult | ReleaseResult): string {
    return `${result.status} · ${result.count}/10`;
  }

  async function release() {
    setLastResult(formatResult(await runtime.releaseAllForRequiem()));
  }

  function seed(count: number) {
    runtime.seedCollectedSouls(count);
    setLastResult(`seeded · ${count}/10`);
  }

  function jumpToSelectedScene() {
    window.dispatchEvent(new CustomEvent("soulbound:debug-jump-scene", {
      detail: { sceneId: definition.sceneId },
    }));
  }

  return (
    <div className={styles.sandbox} data-testid="soul-collection-sandbox">
      <div className={styles.sourceArea}>
        <p>TEXT SOURCE · ordinary DOM typography</p>
        <h1 ref={sourceRef} data-testid="collection-source-text">
          SOUL COLLECTION TEST
        </h1>
        <span className={styles.point} aria-hidden="true" />
      </div>

      <aside className={styles.panel}>
        <header>
          <div>
            <strong>SOUL COLLECTION</strong>
            <small>Phase 5 transaction sandbox</small>
          </div>
          <button
            type="button"
            data-testid="collection-audio-unlock"
            onClick={() => void audio.unlockAudio()}
          >
            {audioSnapshot.isUnlocked ? "Audio unlocked" : "Unlock audio"}
          </button>
        </header>

        <div className={styles.body}>
          <section>
            <h2>Status</h2>
            <dl className={styles.metrics}>
              <div><dt>count</dt><dd data-testid="collection-count">{snapshot.count} / 10</dd></div>
              <div><dt>transaction</dt><dd>{snapshot.activeSoulId ?? "none"}</dd></div>
              <div><dt>claim stage</dt><dd data-testid="claim-stage">{snapshot.claimStage}</dd></div>
              <div><dt>claim locked</dt><dd>{snapshot.claimLocked ? "yes" : "no"}</dd></div>
              <div><dt>waiting audio</dt><dd>{snapshot.waitingAudioActive ? "active" : "off"}</dd></div>
              <div><dt>assigned voice</dt><dd>{snapshot.assignedVoice ?? "none"}</dd></div>
              <div><dt>hit radius</dt><dd>{snapshot.claimTarget ? `${snapshot.claimTarget.radius}px` : "none"}</dd></div>
              <div><dt>waiting size</dt><dd data-testid="waiting-screen-size">{snapshot.waitingVisual ? `${snapshot.waitingVisual.screenSize.toFixed(1)}px` : "none"}</dd></div>
              <div><dt>waiting safe</dt><dd data-testid="waiting-viewport-safe">{snapshot.waitingVisual ? (snapshot.waitingVisual.viewportSafe ? "yes" : "no") : "none"}</dd></div>
              <div><dt>waiting issues</dt><dd data-testid="waiting-visibility-issues">{snapshot.waitingVisual?.issues.join(", ") || "none"}</dd></div>
              <div><dt>HUD</dt><dd>{snapshot.hudMode}</dd></div>
              <div><dt>release</dt><dd>{snapshot.releaseState}</dd></div>
              <div><dt>released</dt><dd>{snapshot.releasedCount}</dd></div>
              <div><dt>audio</dt><dd data-testid="collection-audio-context">{audioSnapshot.contextState}</dd></div>
              <div><dt>cinematic gate</dt><dd data-testid="collection-cinematic-silence">{audioSnapshot.cinematicSilence.active ? "active" : "open"}</dd></div>
              <div><dt>music</dt><dd data-testid="collection-music-state">{audioSnapshot.music.state ?? "none"} / decks {audioSnapshot.activeMusicDeckCount}</dd></div>
              <div><dt>ambient</dt><dd data-testid="collection-ambient-active">{audioSnapshot.activeAmbientCount}</dd></div>
              <div><dt>active SFX</dt><dd data-testid="collection-audio-active">{audioSnapshot.activeSfxCount}</dd></div>
              <div><dt>procedural</dt><dd data-testid="collection-procedural-active">{audioSnapshot.activeProceduralCount}</dd></div>
              <div><dt>music tone</dt><dd data-testid="collection-music-tone">{Math.round(audioSnapshot.musicTone.frequency)} Hz / {audioSnapshot.musicTone.presence.toFixed(2)}</dd></div>
              <div><dt>visual Souls</dt><dd data-testid="collection-visual-souls">{visualSnapshot.souls}</dd></div>
              <div><dt>particles / trails</dt><dd data-testid="collection-visual-effects">{visualSnapshot.particleSystems} / {visualSnapshot.trails}</dd></div>
              <div><dt>binding</dt><dd>{boundOwner ? `${boundOwner.sceneId}#${boundOwner.runId}` : "debug global"}</dd></div>
              <div><dt>result</dt><dd data-testid="collection-result">{lastResult}</dd></div>
            </dl>
            <ol className={styles.slotStates}>
              {snapshot.slots.map((slot) => (
                <li key={slot.soulId} data-status={slot.status}>
                  <span>{slot.slotIndex}</span>
                  <span>{slot.soulId}</span>
                  <strong>{slot.status}</strong>
                </li>
              ))}
            </ol>
          </section>

          <section className={styles.configuration}>
            <h2>Ritual</h2>
            <label>
              Soul
              <select value={soulId} onChange={(event) => setSoulId(event.target.value as SoulId)}>
                {SOUL_IDS.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </label>
            <label>
              Variant
              <select value={variant} onChange={(event) => setVariant(event.target.value as CollectionVariant)}>
                {VARIANTS.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Voice
              <select value={voice} onChange={(event) => setVoice(event.target.value as SoulVoice)}>
                {VOICES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label>
              Soul state
              <select value={visualState} onChange={(event) => setVisualState(event.target.value as SoulState)}>
                {VISUAL_STATES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <div className={styles.row}>
              <button type="button" data-testid="collect-text" onClick={() => void collectFromText()}>COLLECT FROM TEXT</button>
              <button type="button" data-testid="collect-point" onClick={() => void collectFromPoint()}>SPAWN WAITING SOUL</button>
              <button type="button" onClick={() => runtime.claimActiveSoul("POINTER")}>SIMULATE HOVER</button>
              <button type="button" onClick={() => runtime.claimActiveSoul("FORCE")}>FORCE CLAIM</button>
              <button type="button" onClick={() => runtime.claimActiveSoul("TOUCH")}>TOUCH CLAIM</button>
              <button type="button" onClick={() => runtime.claimActiveSoul("KEYBOARD")}>KEYBOARD CLAIM</button>
              <button type="button" data-testid="cancel-collection" onClick={() => runtime.cancelActiveCollection()}>CANCEL</button>
            </div>
          </section>

          <section>
            <h2>HUD</h2>
            <div className={styles.row}>
              <button type="button" onClick={() => runtime.showHud()}>SHOW</button>
              <button type="button" onClick={() => runtime.dimHud()}>DIM</button>
              <button type="button" onClick={() => runtime.hideHud()}>HIDE</button>
            </div>
          </section>

          <section>
            <h2>Scene-run cancellation</h2>
            <div className={styles.row}>
              <button type="button" onClick={jumpToSelectedScene}>JUMP TO {definition.sceneId}</button>
              <button type="button" onClick={() => window.dispatchEvent(new Event("soulbound:debug-restart-scene"))}>RESTART RUN</button>
              <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("soulbound:debug-jump-scene", { detail: { sceneId: "PRE_FINAL" } }))}>JUMP AWAY</button>
            </div>
          </section>

          <section>
            <h2>Seed / release</h2>
            <div className={styles.row}>
              {[0, 1, 5, 9, 10].map((count) => (
                <button key={count} type="button" onClick={() => seed(count)}>SEED {count}</button>
              ))}
              <button type="button" data-testid="release-souls" onClick={() => void release()}>RELEASE ALL FOR REQUIEM</button>
              <button type="button" onClick={() => runtime.disposeReleasedSouls()}>DISPOSE RELEASED SOULS</button>
              <button type="button" data-testid="reset-souls" onClick={() => { runtime.resetSoulCollection(); setLastResult("reset"); }}>RESET COLLECTION</button>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
