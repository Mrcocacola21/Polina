"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";

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
    const onRestored = () => runtime.setWebGLState("ready", gl.getPixelRatio(), [size.width, size.height]);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [gl, runtime, size.height, size.width]);
  return null;
}

export function GlobalWebGLCanvas() {
  const runtime = useVisualRuntime();
  useVisualSnapshot();
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
        if (!supported) runtime.setWebGLState("unavailable");
      }, 0);
    } catch {
      timer = window.setTimeout(() => {
        setAvailable(false);
        runtime.setWebGLState("unavailable");
      }, 0);
    }
    return () => window.clearTimeout(timer);
  }, [runtime]);

  if (!available) {
    return <div className={styles.webglFallback} aria-hidden="true" />;
  }

  return (
    <div className={styles.webglLayer} data-testid="global-webgl-canvas">
      <Canvas
        orthographic
        camera={{ position: [0, 0, 10], zoom: 100, near: 0.1, far: 100 }}
        dpr={[1, runtime.dprCap]}
        gl={{ alpha: true, antialias: false, powerPreference: "high-performance" }}
        resize={{ scroll: false, debounce: { scroll: 0, resize: 80 } }}
        onCreated={({ gl, size }) => {
          gl.setClearColor(0x000000, 0);
          runtime.setWebGLState("ready", gl.getPixelRatio(), [size.width, size.height]);
        }}
      >
        <CameraBridge />
        <WebGLLifecycle />
        <VisualObjects />
      </Canvas>
    </div>
  );
}
