"use client";

import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";

import {
  useSoulCollectionRuntime,
  useSoulCollectionSnapshot,
} from "@/lib/souls/SoulCollectionContext";
import type { SoulClaimTarget as ClaimTarget } from "@/lib/souls/types";

import styles from "./SoulClaimTarget.module.css";

type TargetStyle = CSSProperties & Record<`--soul-claim-${string}`, string>;
type PointerPosition = Readonly<{ x: number; y: number }>;

function contains(target: ClaimTarget, point: PointerPosition): boolean {
  return Math.hypot(point.x - target.center[0], point.y - target.center[1]) <= target.radius;
}

export function SoulClaimTarget() {
  const runtime = useSoulCollectionRuntime();
  const snapshot = useSoulCollectionSnapshot();
  const elementRef = useRef<HTMLButtonElement>(null);
  const targetRef = useRef(snapshot.claimTarget);
  const latestPointerRef = useRef<PointerPosition | null>(null);
  const insideRef = useRef(false);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const point = { x: event.clientX, y: event.clientY };
      latestPointerRef.current = point;
      const target = targetRef.current;
      if (!target) return;
      const inside = contains(target, point);
      if (inside === insideRef.current) return;
      const entered = !insideRef.current && inside;
      insideRef.current = inside;
      if (elementRef.current) elementRef.current.dataset.near = inside ? "true" : "false";
      runtime.setClaimProximity(inside);
      if (entered) runtime.claimActiveSoul("POINTER");
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [runtime]);

  useEffect(() => {
    targetRef.current = snapshot.claimTarget;
    const point = latestPointerRef.current;
    const inside = Boolean(snapshot.claimTarget && point && contains(snapshot.claimTarget, point));
    // A Soul born beneath a stationary pointer begins inside. Only a later
    // outside -> inside transition is accepted as an intentional hover claim.
    insideRef.current = inside;
    if (elementRef.current) elementRef.current.dataset.near = inside ? "true" : "false";
    runtime.setClaimProximity(inside);
  }, [runtime, snapshot.claimTarget]);

  const target = snapshot.claimTarget;
  if (!target || snapshot.claimStage !== "WAITING") return null;

  const style: TargetStyle = {
    "--soul-claim-x": `${target.center[0]}px`,
    "--soul-claim-y": `${target.center[1]}px`,
    "--soul-claim-size": `${target.radius * 2}px`,
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    runtime.claimActiveSoul("KEYBOARD");
  };

  return (
    <button
      ref={elementRef}
      className={styles.target}
      style={style}
      type="button"
      data-testid="soul-claim-target"
      data-soul-id={target.soulId}
      data-near="false"
      aria-label={`Collect ${target.soulId.replace("SOUL_", "Soul ")} of 10`}
      onFocus={() => runtime.setClaimProximity(true)}
      onBlur={() => runtime.setClaimProximity(false)}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => {
        if (event.pointerType === "touch" || event.pointerType === "pen") {
          event.preventDefault();
          runtime.claimActiveSoul("TOUCH");
        }
      }}
      onTouchStart={() => runtime.claimActiveSoul("TOUCH")}
      onClick={(event) => {
        if (event.detail === 0) runtime.claimActiveSoul("KEYBOARD");
      }}
    />
  );
}
