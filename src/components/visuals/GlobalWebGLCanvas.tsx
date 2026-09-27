"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useState, type CSSProperties } from "react";

import { useCapabilities } from "@/lib/accessibility/CapabilityContext";
import { effectiveWebGL } from "@/lib/accessibility/capabilities";

import {
  useVisualRuntime,
  useVisualSnapshot,
} from "@/lib/visuals/VisualRuntimeContext";

import { VisualObjects } from "./VisualObjects";
import styles from "./visuals.module.css";

function CameraBridge() {
  const runtime = useVisualRuntime();
  const { camera, gl, size } = useThree();

  useEffect(() => {
    runtime.setCameraBridge(camera, size.width, size.height);
    runtime.setWebGLState("ready", gl.getPixelRatio(), [size.width, size.height]);
  }, [camera, gl, runtime, size.height, size.width]);

  useFrame((_state, delta) => {
    runtime.setCameraBridge(camera, size.width, size.height);
    runtime.sampleFrame(delta * 1000);
  });
  return null;
}

function WebGLLifecycle() {
  const runtime = useVisualRuntime();
  const { gl, size } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (event: Event) => {
      event.preventDefault();
      runtime.setWebGLState("lost", gl.getPixelRatio(), [size.width, size.height]);
    };
    // Stay in the stable DOM fallback until a full runtime restart. Mid-scene
    // restoration would otherwise jump between two unrelated coordinate spaces.
    const onRestored = () => runtime.setWebGLState("lost", gl.getPixelRatio(), [size.width, size.height]);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [gl, runtime, size.height, size.width]);
  return null;
}

type FallbackSoulStyle = CSSProperties & {
  "--fallback-opacity": number;
  "--fallback-scale": number;
};

function DomVisualFallback() {
  const runtime = useVisualRuntime();
  useVisualSnapshot();
  const width = runtime.getSnapshot().viewport[0] || (typeof window !== "undefined" ? window.innerWidth : 1);
  const height = runtime.getSnapshot().viewport[1] || (typeof window !== "undefined" ? window.innerHeight : 1);
  return (
    <div className={styles.soulForegroundLayer} aria-hidden="true" data-testid="webgl-dom-fallback">
      {[...runtime.souls.values()].filter((soul) => soul.visible).map((soul) => {
        const point = runtime.worldToScreen(soul.position) ?? [width / 2, height / 2];
        const style: FallbackSoulStyle = {
          left: `${point[0]}px`,
          top: `${point[1]}px`,
          "--fallback-opacity": soul.opacity,
          "--fallback-scale": Math.max(0.45, soul.scale),
        };
        return <span key={soul.id} className={styles.fallbackSoul} style={style} data-state={soul.state} />;
      })}
    </div>
  );
}

export function GlobalWebGLCanvas() {
  const runtime = useVisualRuntime();
  const snapshot = useVisualSnapshot();
  const capabilities = useCapabilities();
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let timer = 0;
    try {
      const probe = document.createElement("canvas");
      const supported = Boolean(
        probe.getContext("webgl2") || probe.getContext("webgl"),
      );
      timer = window.setTimeout(() => {
        setAvailable(supported);
        if (!supported) runtime.setWebGLState("unavailable", 1, [window.innerWidth, window.innerHeight]);
      }, 0);
    } catch {
      timer = window.setTimeout(() => {
        setAvailable(false);
        runtime.setWebGLState("unavailable", 1, [window.innerWidth, window.innerHeight]);
      }, 0);
    }
    return () => window.clearTimeout(timer);
  }, [runtime]);

  useEffect(() => {
    if (available && effectiveWebGL(capabilities) && snapshot.webgl !== "lost") return;
    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        runtime.setWebGLState(snapshot.webgl === "lost" ? "lost" : "unavailable", 1, [window.innerWidth, window.innerHeight]);
      });
    };
    update();
    window.addEventListener("resize", update, { passive: true });
    window.visualViewport?.addEventListener("resize", update, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [available, capabilities, runtime, snapshot.webgl]);

  if (!available || !effectiveWebGL(capabilities) || snapshot.webgl === "lost") {
    return (
      <>
        <div className={styles.webglFallback} aria-hidden="true" />
        <DomVisualFallback />
      </>
    );
  }

  return (
    <>
      <div className={styles.webglLayer} data-testid="global-webgl-canvas">
        <Canvas
          aria-hidden="true"
          orthographic
          camera={{ position: [0, 0, 10], zoom: 100, near: 0.1, far: 100 }}
          dpr={[1, runtime.dprCap]}
          gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
          frameloop={capabilities.visibility === "hidden" ? "never" : "always"}
          resize={{ scroll: false, debounce: { scroll: 0, resize: 80 } }}
          onCreated={({ gl, size }) => {
            gl.setClearColor(0x000000, 0);
            runtime.setWebGLState("ready", gl.getPixelRatio(), [size.width, size.height]);
          }}
        >
          <CameraBridge />
          <WebGLLifecycle />
          <VisualObjects souls={false} />
        </Canvas>
      </div>
      {snapshot.souls > 0 ? (
        <div className={styles.soulForegroundLayer} data-testid="soul-foreground-canvas">
          <Canvas
            aria-hidden="true"
            orthographic
            camera={{ position: [0, 0, 10], zoom: 100, near: 0.1, far: 100 }}
            dpr={1}
            gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
            frameloop={capabilities.visibility === "hidden" ? "never" : "always"}
            resize={{ scroll: false, debounce: { scroll: 0, resize: 80 } }}
            onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
          >
            <VisualObjects particles={false} />
          </Canvas>
        </div>
      ) : null}
    </>
  );
}
