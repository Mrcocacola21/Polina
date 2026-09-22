"use client";

import { useEffect, useRef } from "react";

import { type SoulId } from "@/lib/souls/registry";
import {
  useSoulCollectionRuntime,
  useSoulCollectionSnapshot,
} from "@/lib/souls/SoulCollectionContext";
import type { SoulSlot } from "@/lib/souls/types";

import styles from "./SoulHud.module.css";

function SoulHudSlot({ slot }: Readonly<{ slot: SoulSlot }>) {
  const runtime = useSoulCollectionRuntime();
  const elementRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    runtime.registerSlot(slot.soulId, elementRef.current);
    return () => runtime.registerSlot(slot.soulId, null);
  }, [runtime, slot.soulId]);

  return (
    <li
      ref={elementRef}
      className={styles.slot}
      data-testid={`soul-slot-${slot.soulId}`}
      data-soul-id={slot.soulId}
      data-slot-index={slot.slotIndex}
      data-slot-status={slot.status}
      aria-hidden="true"
    >
      <span />
    </li>
  );
}

export function SoulHud() {
  const snapshot = useSoulCollectionSnapshot();
  const hidden = snapshot.hudMode === "HIDDEN";

  return (
    <aside
      className={styles.hud}
      data-testid="soul-hud"
      data-hud-mode={snapshot.hudMode}
      data-release-state={snapshot.releaseState}
      aria-hidden={hidden ? "true" : undefined}
    >
      <p className={styles.label}>SOULS</p>
      <ol className={styles.slots} aria-hidden="true">
        {snapshot.slots.map((slot) => (
          <SoulHudSlot key={slot.soulId} slot={slot} />
        ))}
      </ol>
      <p className={styles.count} data-testid="soul-count">
        {String(snapshot.count).padStart(2, "0")} / 10
      </p>
      <p className={styles.srOnly} aria-live="polite">
        {snapshot.count} of 10 souls collected
      </p>
    </aside>
  );
}

export type { SoulId };

