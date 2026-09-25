"use client";

import { useEffect, useRef } from "react";

import {
  useVisualFx,
  useVisualRuntime,
} from "@/lib/visuals/VisualRuntimeContext";

import styles from "./visuals.module.css";

export function CustomCursor() {
  const runtime = useVisualRuntime();
  const fx = useVisualFx();
  const rootRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ targetX: 0, targetY: 0, x: 0, y: 0 });

  useEffect(() => {
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    let raf = 0;
    let visible = false;
    const updateCapability = () => {
      runtime.setPointerType(finePointer.matches ? "fine" : "coarse");
      document.documentElement.classList.toggle("soulbound-custom-cursor", finePointer.matches);
    };
    const onPointerMove = (event: PointerEvent) => {
      pointerRef.current.targetX = event.clientX;
      pointerRef.current.targetY = event.clientY;
      runtime.pointer.raw.x = (event.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
      runtime.pointer.raw.y = -((event.clientY / Math.max(1, window.innerHeight)) * 2 - 1);
      visible = true;
    };
    const animate = () => {
      const pointer = pointerRef.current;
      pointer.x += (pointer.targetX - pointer.x) * 0.18;
      pointer.y += (pointer.targetY - pointer.y) * 0.18;
      runtime.pointer.smoothed.x += (runtime.pointer.raw.x - runtime.pointer.smoothed.x) * 0.095;
      runtime.pointer.smoothed.y += (runtime.pointer.raw.y - runtime.pointer.smoothed.y) * 0.095;
      if (rootRef.current) {
        rootRef.current.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0)`;
        rootRef.current.style.opacity = visible ? "1" : "0";
        rootRef.current.dataset.normalizedX = runtime.pointer.raw.x.toFixed(3);
        rootRef.current.dataset.normalizedY = runtime.pointer.raw.y.toFixed(3);
      }
      if (trailRef.current) {
        trailRef.current.style.transform = `translate3d(${pointer.x + (pointer.targetX - pointer.x) * 0.35}px, ${pointer.y + (pointer.targetY - pointer.y) * 0.35}px, 0)`;
      }
      raf = window.requestAnimationFrame(animate);
    };

    updateCapability();
    finePointer.addEventListener("change", updateCapability);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    raf = window.requestAnimationFrame(animate);
    return () => {
      finePointer.removeEventListener("change", updateCapability);
      window.removeEventListener("pointermove", onPointerMove);
      window.cancelAnimationFrame(raf);
      document.documentElement.classList.remove("soulbound-custom-cursor");
    };
  }, [runtime]);

  return (
    <>
      <div ref={trailRef} className={styles.cursorTrail} aria-hidden="true" />
      <div
        ref={rootRef}
        className={styles.cursor}
        data-cursor-mode={fx.cursor}
        aria-hidden="true"
      >
        <span className={styles.cursorRing} />
        <span className={styles.cursorCore} />
      </div>
    </>
  );
}
