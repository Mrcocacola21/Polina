"use client";

import { useEffect, useRef, useState } from "react";

import type { ParticleFieldController, SoulController } from "@/lib/visuals/VisualRuntime";
import type { CursorMode, FogVariant, ParticleMode, SoulState, TransitionType } from "@/lib/visuals/types";
import {
  useVisualRuntime,
  useVisualSnapshot,
} from "@/lib/visuals/VisualRuntimeContext";

import styles from "./VisualSandbox.module.css";

const SOUL_STATES: readonly SoulState[] = ["DORMANT", "ACTIVE", "CHARGED"];
const PARTICLE_MODES: readonly ParticleMode[] = ["AMBIENT_DRIFT", "ATTRACT", "BURST", "ORBIT", "DISSOLVE"];
const FOG_VARIANTS: readonly FogVariant[] = ["NEUTRAL", "CRIMSON", "HEAVY"];
const CURSOR_MODES: readonly CursorMode[] = ["DEFAULT", "INTERACTIVE", "DIMMED", "ABSORPTION", "HIDDEN"];
const TRANSITIONS: readonly TransitionType[] = ["ORGANIC_DISSOLVE", "SMOKE_REVEAL", "SOUL_CIRCLE", "VERTICAL_SLIT", "FADE"];

export function VisualSandbox() {
  const runtime = useVisualRuntime();
  const metrics = useVisualSnapshot();
  const soulsRef = useRef<SoulController[]>([]);
  const particleRef = useRef<ParticleFieldController | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [soulState, setSoulState] = useState<SoulState>("ACTIVE");
  const [particleCount, setParticleCount] = useState(420);
  const [particleSize, setParticleSize] = useState(0.12);
  const [particleSpeed, setParticleSpeed] = useState(0.45);
  const [fogOpacity, setFogOpacity] = useState(0.55);
  const [grain, setGrain] = useState(0.055);
  const [vignette, setVignette] = useState(0.42);
  const [parallax, setParallax] = useState(8);

  useEffect(() => {
    let frame = 0;
    const animate = () => {
      if (cardRef.current) {
        const { x, y } = runtime.pointer.smoothed;
        cardRef.current.style.transform = `translate3d(${x * parallax}px, ${-y * parallax}px, 0) rotateX(${y * 1.5}deg) rotateY(${x * 1.5}deg)`;
        cardRef.current.dataset.pointer = `${x.toFixed(2)}, ${y.toFixed(2)}`;
      }
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [parallax, runtime]);

  useEffect(() => () => runtime.reset(), [runtime]);

  function createSouls(count: number) {
    disposeSouls();
    soulsRef.current = Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * Math.PI * 2;
      return runtime.createSoul({
        state: soulState,
        scale: count >= 10 ? 0.62 : 1,
        position: count === 1 ? [0, 0, 0] : [Math.cos(angle) * 2.4, Math.sin(angle) * 1.7, 0],
        scopeId: "sandbox",
      });
    });
  }

  function disposeSouls() {
    for (const soul of soulsRef.current) soul.dispose();
    soulsRef.current = [];
  }

  function forEachSoul(action: (soul: SoulController, index: number) => void) {
    if (soulsRef.current.length === 0) createSouls(1);
    soulsRef.current.forEach(action);
  }

  function setState(state: SoulState) {
    setSoulState(state);
    forEachSoul((soul) => void soul.setState(state));
  }

  function startOrbit() {
    forEachSoul((soul, index) => soul.startOrbit({
      radius: soulsRef.current.length >= 10 ? 2.7 : 2,
      speed: 0.45 + (index % 2) * 0.08,
      phase: (index / soulsRef.current.length) * Math.PI * 2,
    }));
  }

  function runParticleMode(mode: ParticleMode) {
    particleRef.current?.dispose();
    particleRef.current = runtime.spawnParticleField({
      mode,
      count: particleCount,
      size: [particleSize * 0.6, particleSize * 1.4],
      velocity: particleSpeed,
      attraction: [0, 0, 0],
      spread: mode === "BURST" ? [0.12, 0.12, 0.12] : [8, 5, 2],
      lifetime: mode === "BURST" || mode === "DISSOLVE" ? 2.3 : 0,
      scopeId: "sandbox",
    });
  }

  function reset() {
    soulsRef.current = [];
    particleRef.current = null;
    runtime.reset();
    runtime.activateScope("sandbox");
    setSoulState("ACTIVE");
    setGrain(0.055);
    setVignette(0.42);
  }

  return (
    <div className={styles.sandbox} data-testid="visual-sandbox">
      <div ref={cardRef} className={styles.parallaxCard}>
        <span>POINTER PARALLAX</span>
        <small>normalized pointer → ±{parallax}px</small>
      </div>

      <aside className={`${styles.panel} ${collapsed ? styles.collapsed : ""}`}>
        <header>
          <div>
            <strong>VISUAL SANDBOX</strong>
            <small>Phase 4 reusable primitives</small>
          </div>
          <button type="button" onClick={() => setCollapsed((value) => !value)}>
            {collapsed ? "Open" : "Collapse"}
          </button>
        </header>

        {!collapsed ? (
          <div className={styles.body}>
            <section>
              <h2>Metrics</h2>
              <dl className={styles.metrics}>
                <div><dt>WebGL</dt><dd>{metrics.webgl}</dd></div>
                <div><dt>DPR</dt><dd>{metrics.dpr.toFixed(2)} / {runtime.dprCap}</dd></div>
                <div><dt>viewport</dt><dd>{metrics.viewport.join(" × ")}</dd></div>
                <div><dt>souls</dt><dd>{metrics.souls}</dd></div>
                <div><dt>particle fields</dt><dd>{metrics.particleSystems}</dd></div>
                <div><dt>particles</dt><dd>{metrics.particles}</dd></div>
                <div><dt>trails</dt><dd>{metrics.trails}</dd></div>
                <div><dt>scopes</dt><dd>{metrics.scopes}</dd></div>
                <div><dt>fog</dt><dd>{metrics.fog ?? "OFF"}</dd></div>
                <div><dt>transition</dt><dd>{metrics.transition}</dd></div>
                <div><dt>cursor</dt><dd>{metrics.cursor} / {metrics.pointerType}</dd></div>
              </dl>
              <div className={styles.row}>
                {(["HIGH", "MEDIUM", "LOW"] as const).map((quality) => (
                  <button key={quality} type="button" onClick={() => runtime.setQuality(quality)}>{quality}</button>
                ))}
              </div>
            </section>

            <section>
              <h2>Soul</h2>
              <div className={styles.row}>
                <button type="button" onClick={() => createSouls(1)}>Create 1</button>
                <button type="button" onClick={() => createSouls(3)}>Create 3</button>
                <button type="button" onClick={() => createSouls(10)}>Create 10</button>
                <button type="button" onClick={disposeSouls}>Dispose all</button>
              </div>
              <div className={styles.row}>
                {SOUL_STATES.map((state) => <button key={state} type="button" onClick={() => setState(state)}>{state}</button>)}
              </div>
              <div className={styles.row}>
                <button type="button" onClick={() => forEachSoul((soul) => void soul.spawn({ state: soulState }))}>Spawn</button>
                <button type="button" onClick={() => forEachSoul((soul) => soul.startBreathing())}>Breathe</button>
                <button type="button" onClick={() => forEachSoul((soul) => soul.stopBreathing())}>Stop breathe</button>
                <button type="button" onClick={() => forEachSoul((soul) => void soul.charge())}>Charge</button>
                <button type="button" onClick={() => forEachSoul((soul, index) => void soul.flyTo({ screen: [window.innerWidth * (index % 2 ? 0.22 : 0.78), window.innerHeight * (index % 3 ? 0.72 : 0.25)] }, { curve: index % 2 ? -1.8 : 1.8 }))}>Curved fly</button>
                <button type="button" onClick={startOrbit}>Orbit</button>
                <button type="button" onClick={() => forEachSoul((soul) => soul.stopOrbit())}>Stop orbit</button>
                <button type="button" onClick={() => forEachSoul((soul) => void soul.dissolve())}>Dissolve</button>
              </div>
            </section>

            <section>
              <h2>Particles</h2>
              <div className={styles.ranges}>
                <label>count <input type="range" min="50" max="1500" step="50" value={particleCount} onChange={(event) => setParticleCount(Number(event.target.value))} /><span>{particleCount}</span></label>
                <label>size <input type="range" min="0.03" max="0.3" step="0.01" value={particleSize} onChange={(event) => setParticleSize(Number(event.target.value))} /><span>{particleSize}</span></label>
                <label>speed <input type="range" min="0.1" max="1.5" step="0.05" value={particleSpeed} onChange={(event) => setParticleSpeed(Number(event.target.value))} /><span>{particleSpeed}</span></label>
              </div>
              <div className={styles.row}>
                {PARTICLE_MODES.map((mode) => <button key={mode} type="button" onClick={() => runParticleMode(mode)}>{mode.replace("_", " ")}</button>)}
                <button type="button" onClick={() => { particleRef.current?.dispose(); particleRef.current = null; }}>Clear</button>
              </div>
            </section>

            <section>
              <h2>Fog & global FX</h2>
              <div className={styles.row}>
                <button type="button" onClick={() => runtime.hideFog()}>Fog off</button>
                {FOG_VARIANTS.map((fog) => <button key={fog} type="button" onClick={() => runtime.setFog(fog, fogOpacity)}>{fog}</button>)}
              </div>
              <div className={styles.ranges}>
                <label>fog <input type="range" min="0" max="1" step="0.05" value={fogOpacity} onChange={(event) => { const value = Number(event.target.value); setFogOpacity(value); if (runtime.fx.fog) runtime.setFog(runtime.fx.fog, value); }} /><span>{fogOpacity}</span></label>
                <label>grain <input type="range" min="0" max="0.3" step="0.005" value={grain} onChange={(event) => { const value = Number(event.target.value); setGrain(value); runtime.setGrain(value); }} /><span>{grain}</span></label>
                <label>vignette <input type="range" min="0" max="1" step="0.05" value={vignette} onChange={(event) => { const value = Number(event.target.value); setVignette(value); runtime.setVignette(value); }} /><span>{vignette}</span></label>
                <label>parallax <input type="range" min="0" max="24" step="1" value={parallax} onChange={(event) => setParallax(Number(event.target.value))} /><span>{parallax}px</span></label>
              </div>
              <div className={styles.row}>
                <button type="button" onClick={() => runtime.setLightLeak(0)}>Leak off</button>
                <button type="button" onClick={() => runtime.setLightLeak(0.65, { scale: 1.2, position: [72, 35], rotation: -8, drift: true })}>Leak on</button>
              </div>
              <div className={styles.domGlow}>DOM GLOW</div>
            </section>

            <section>
              <h2>Cursor</h2>
              <div className={styles.row}>
                {CURSOR_MODES.map((mode) => <button key={mode} type="button" onClick={() => runtime.setCursorMode(mode)}>{mode}</button>)}
              </div>
            </section>

            <section>
              <h2>Transitions</h2>
              <div className={styles.row}>
                {TRANSITIONS.map((transition) => <button key={transition} type="button" onClick={() => void runtime.transition(transition, 0.75)}>{transition.replace("_", " ")}</button>)}
                <button type="button" onClick={() => runtime.cancelTransition()}>Cancel</button>
              </div>
            </section>

            <button className={styles.reset} type="button" onClick={reset}>RESET VISUAL SANDBOX</button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

