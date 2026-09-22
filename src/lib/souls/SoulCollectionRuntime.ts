import type { AudioEngine } from "@/lib/audio/AudioEngine";
import type { AudioHandle } from "@/lib/audio/types";
import type { SceneId } from "@/lib/cinematic/scenes";
import type { ScenePhase } from "@/lib/cinematic/types";
import type {
  ParticleFieldController,
  SoulController,
  VisualRuntime,
} from "@/lib/visuals/VisualRuntime";
import { createSceneVisualScopeId } from "@/lib/visuals/VisualScope";
import type { Vec3 } from "@/lib/visuals/types";
import { createSceneAudioScopeId } from "@/lib/audio/scopes";

import {
  abortSoulRelease,
  beginSoulCollection,
  beginSoulRelease,
  cancelSoulCollection,
  commitSoulCollection,
  commitSoulRelease,
  createInitialSoulCollectionState,
  deriveSoulCount,
  seedSoulCollection,
  setSoulHudMode,
} from "./collection-state";
import type { SoulId } from "./registry";
import { createTextFragmentOverlay, type TextFragmentOverlay } from "./text-source";
import type {
  CollectSoulOptions,
  CollectionResult,
  CollectionTiming,
  CollectionVariant,
  ReleaseResult,
  SoulCollectionState,
  SoulHudMode,
  SoulSlot,
  SoulVoice,
} from "./types";

const RELEASE_SCOPE_ID = "soul-collection:released";

const TIMINGS: Readonly<Record<CollectionVariant, CollectionTiming>> = {
  NORMAL: {
    glow: 0.55,
    fragment: 0.65,
    gather: 0.62,
    spawn: 0.72,
    stabilize: 0.3,
    flight: 0.92,
    absorb: 0.34,
  },
  SILENT: {
    glow: 0.55,
    fragment: 0.65,
    gather: 0.62,
    spawn: 0.72,
    stabilize: 0.3,
    flight: 0.92,
    absorb: 0.34,
  },
  DEEP: {
    glow: 0.68,
    fragment: 0.78,
    gather: 0.8,
    spawn: 0.88,
    stabilize: 0.46,
    flight: 1.12,
    absorb: 0.48,
  },
};

type SceneOwner = Readonly<{ sceneId: SceneId; runId: number }>;

type ActiveTransaction = {
  id: number;
  soulId: SoulId;
  owner?: SceneOwner;
  controller: AbortController;
  promise: Promise<CollectionResult>;
  overlay?: TextFragmentOverlay;
  sourceElement?: HTMLElement;
  particle?: ParticleFieldController;
  soul?: SoulController;
  audio: Set<AudioHandle>;
  committed: boolean;
};

export type ReleasedSoul = Readonly<{
  soulId: SoulId;
  slotIndex: number;
  controller: SoulController;
}>;

export type SoulCollectionSnapshot = Readonly<{
  slots: readonly SoulSlot[];
  count: number;
  activeSoulId: SoulId | null;
  hudMode: SoulHudMode;
  releaseState: SoulCollectionState["releaseState"];
  releasedCount: number;
}>;

class CancelledCollectionError extends Error {}

function wait(seconds: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => finish(true), Math.max(0, seconds) * 1000);
    const abort = () => finish(false);
    const finish = (completed: boolean) => {
      window.clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      resolve(completed);
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}

export class SoulCollectionRuntime {
  readonly #visual: VisualRuntime;
  readonly #audio: AudioEngine;
  readonly #listeners = new Set<() => void>();
  readonly #slotElements = new Map<SoulId, HTMLElement>();
  #state = createInitialSoulCollectionState();
  #active?: ActiveTransaction;
  #released: ReleasedSoul[] = [];
  #revision = 0;
  #sequence = 0;
  #scene?: Readonly<{ sceneId: SceneId; runId: number; phase: ScenePhase }>;

  constructor(visual: VisualRuntime, audio: AudioEngine) {
    this.#visual = visual;
    this.#audio = audio;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  readonly getRevision = (): number => this.#revision;

  #notify(): void {
    this.#revision += 1;
    for (const listener of this.#listeners) listener();
  }

  getSnapshot(): SoulCollectionSnapshot {
    return {
      slots: this.#state.slots,
      count: deriveSoulCount(this.#state),
      activeSoulId: this.#state.activeSoulId,
      hudMode: this.#state.hudMode,
      releaseState: this.#state.releaseState,
      releasedCount: this.#released.length,
    };
  }

  getCurrentSceneOwner(): SceneOwner | undefined {
    if (!this.#scene || this.#scene.phase === "exiting") return undefined;
    return { sceneId: this.#scene.sceneId, runId: this.#scene.runId };
  }

  observeScene(sceneId: SceneId, runId: number, phase: ScenePhase): void {
    this.#scene = { sceneId, runId, phase };
    const owner = this.#active?.owner;
    if (
      owner &&
      (owner.sceneId !== sceneId || owner.runId !== runId || phase === "exiting")
    ) {
      this.cancelActiveCollection("stale scene run");
    }
  }

  registerSlot(soulId: SoulId, element: HTMLElement | null): void {
    if (element) this.#slotElements.set(soulId, element);
    else this.#slotElements.delete(soulId);
  }

  getSlotCenter(soulId: SoulId): readonly [number, number] | undefined {
    const element = this.#slotElements.get(soulId);
    if (!element) return undefined;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return undefined;
    return [rect.left + rect.width / 2, rect.top + rect.height / 2];
  }

  showHud(): void {
    this.#state = setSoulHudMode(this.#state, "VISIBLE");
    this.#notify();
  }

  dimHud(): void {
    this.#state = setSoulHudMode(this.#state, "DIMMED");
    this.#notify();
  }

  hideHud(): void {
    this.#state = setSoulHudMode(this.#state, "HIDDEN");
    this.#notify();
  }

  collectSoul(options: CollectSoulOptions): Promise<CollectionResult> {
    const started = beginSoulCollection(this.#state, options.soulId);
    if (started.outcome === "already-collected") {
      return Promise.resolve(this.#result("already-collected", options.soulId));
    }
    if (started.outcome === "in-progress" && this.#active) {
      return this.#active.promise;
    }
    if (started.outcome === "busy" || started.outcome === "release-locked") {
      return Promise.resolve(this.#result("busy", options.soulId, started.outcome));
    }
    if (options.owner && !this.#ownerIsCurrent(options.owner)) {
      return Promise.resolve(this.#result("failed", options.soulId, "stale scene run"));
    }

    this.#state = started.state;
    const transaction: ActiveTransaction = {
      id: ++this.#sequence,
      soulId: options.soulId,
      owner: options.owner,
      controller: new AbortController(),
      promise: Promise.resolve(this.#result("failed", options.soulId)),
      audio: new Set(),
      committed: false,
    };
    this.#active = transaction;
    transaction.promise = this.#runTransaction(transaction, options);
    this.#notify();
    return transaction.promise;
  }

  cancelActiveCollection(reason = "cancelled"): void {
    const transaction = this.#active;
    if (!transaction) return;
    transaction.controller.abort(reason);
    this.#state = cancelSoulCollection(this.#state, transaction.soulId);
    this.#cleanupTransaction(transaction, true);
    if (this.#active?.id === transaction.id) this.#active = undefined;
    this.#notify();
  }

  async #runTransaction(
    transaction: ActiveTransaction,
    options: CollectSoulOptions,
  ): Promise<CollectionResult> {
    const variant = options.variant ?? "NORMAL";
    const voice = options.voice ?? "NONE";
    const visualState = options.visualState ?? "ACTIVE";
    const scale = Math.max(0.05, options.timingScale ?? 1) * this.#visual.motionIntensity;
    const base = TIMINGS[variant];
    const timing = Object.fromEntries(
      Object.entries({ ...base, ...options.timing }).map(([key, value]) => [key, value * scale]),
    ) as CollectionTiming;
    const signal = transaction.controller.signal;
    let restoreOnSuccess = options.restoreSourceAfterCollection ?? false;

    try {
      const convergence = this.#prepareSource(transaction, options);
      this.#assertActive(transaction);

      if (transaction.overlay) {
        if (!await transaction.overlay.glow(
          timing.glow,
          variant === "DEEP" ? 0.55 : 0.9,
          signal,
        )) throw new CancelledCollectionError();
        if (!await transaction.overlay.fragment(timing.fragment, signal)) {
          throw new CancelledCollectionError();
        }
      } else if (!await wait(timing.glow + timing.fragment, signal)) {
        throw new CancelledCollectionError();
      }

      const world = this.#visual.screenToWorld(convergence[0], convergence[1]);
      if (!world) throw new Error("VisualRuntime has no screen-to-world camera bridge.");
      const spread = transaction.overlay
        ? this.#worldSpread(transaction.overlay.sourceRect)
        : [1.8, 1.2, 0.8] as const;
      const visualScopeId = options.owner
        ? createSceneVisualScopeId(options.owner.sceneId, options.owner.runId)
        : `soul-collection:debug:${transaction.id}`;
      transaction.particle = this.#visual.spawnParticleField({
        mode: "ATTRACT",
        count: variant === "DEEP" ? 90 : 150,
        position: world,
        spread,
        attraction: world,
        opacity: variant === "DEEP" ? 0.45 : 0.76,
        velocity: variant === "DEEP" ? 0.26 : 0.42,
        lifetime: timing.gather + timing.spawn + 0.2,
        color: variant === "DEEP" ? "#7a0d19" : "#de2440",
        scopeId: visualScopeId,
      });
      if (transaction.overlay) {
        if (!await transaction.overlay.converge(convergence, timing.gather, signal)) {
          throw new CancelledCollectionError();
        }
      } else if (!await wait(timing.gather, signal)) {
        throw new CancelledCollectionError();
      }
      this.#assertActive(transaction);

      transaction.soul = this.#visual.createSoul({
        position: world,
        scale: variant === "DEEP" ? 0.82 : 1,
        state: visualState,
        scopeId: visualScopeId,
      });
      this.#playSpawnAudio(transaction, variant);
      if (!await transaction.soul.spawn({
        position: world,
        duration: timing.spawn,
        state: visualState,
        scale: variant === "DEEP" ? 0.82 : 1,
      })) throw new CancelledCollectionError();
      transaction.particle?.dispose();
      transaction.particle = undefined;
      transaction.soul.startBreathing(variant === "DEEP" ? 0.018 : 0.032);
      if (!await wait(timing.stabilize, signal)) throw new CancelledCollectionError();
      transaction.soul.stopBreathing();
      this.#playVoiceAudio(transaction, variant, voice);
      this.#playFlyAudio(transaction, variant);

      const destination = this.getSlotCenter(options.soulId);
      if (!destination) throw new Error(`HUD slot is unavailable for ${options.soulId}.`);
      if (!await transaction.soul.flyTo(
        { screen: destination },
        {
          duration: timing.flight,
          curve: variant === "DEEP" ? 1.15 : 1.7,
          trail: true,
          scale: 0.16,
        },
      )) throw new CancelledCollectionError();
      this.#assertActive(transaction);
      if (!await this.#absorbSlot(options.soulId, timing.absorb, signal)) {
        throw new CancelledCollectionError();
      }
      this.#assertActive(transaction);

      this.#state = commitSoulCollection(this.#state, options.soulId, {
        variant,
        visualState,
        collectedAt: performance.now(),
      });
      transaction.committed = true;
      if (variant !== "SILENT") {
        const tone = this.#audio.playUiTone({
          frequency: variant === "DEEP" ? 196 : 294,
          durationSeconds: variant === "DEEP" ? 0.18 : 0.12,
          gain: variant === "DEEP" ? 0.018 : 0.025,
          scopeId: options.owner
            ? createSceneAudioScopeId(options.owner.sceneId, options.owner.runId)
            : undefined,
        });
        if (tone) transaction.audio.add(tone);
      }
      this.#notify();
      return this.#result("collected", options.soulId);
    } catch (error) {
      const cancelled = error instanceof CancelledCollectionError || signal.aborted;
      if (!cancelled && process.env.NODE_ENV === "development") {
        console.warn(`Soul collection failed for ${options.soulId}.`, error);
      }
      if (!transaction.committed) {
        this.#state = cancelSoulCollection(this.#state, options.soulId);
      }
      restoreOnSuccess = true;
      this.#notify();
      return this.#result(
        cancelled ? "cancelled" : "failed",
        options.soulId,
        error instanceof Error ? error.message : "collection failed",
      );
    } finally {
      this.#cleanupTransaction(
        transaction,
        transaction.committed ? restoreOnSuccess : true,
        !transaction.committed,
      );
      if (this.#active?.id === transaction.id) this.#active = undefined;
    }
  }

  #prepareSource(
    transaction: ActiveTransaction,
    options: CollectSoulOptions,
  ): readonly [number, number] {
    if (options.source.type === "POINT") {
      return options.convergence ?? options.source.point;
    }
    const overlay = createTextFragmentOverlay(options.source.element, transaction.id * 97);
    if (!overlay) throw new Error("Text source contains no measurable graphemes.");
    transaction.sourceElement = options.source.element;
    transaction.overlay = overlay;
    return options.convergence ?? options.source.convergence ?? overlay.convergence;
  }

  #worldSpread(rect: DOMRect): Vec3 {
    const topLeft = this.#visual.screenToWorld(rect.left, rect.top);
    const bottomRight = this.#visual.screenToWorld(rect.right, rect.bottom);
    if (!topLeft || !bottomRight) return [2, 1, 0.8];
    return [
      Math.max(0.2, Math.abs(bottomRight[0] - topLeft[0])),
      Math.max(0.2, Math.abs(bottomRight[1] - topLeft[1])),
      0.8,
    ];
  }

  #assertActive(transaction: ActiveTransaction): void {
    if (
      transaction.controller.signal.aborted ||
      this.#active?.id !== transaction.id ||
      (transaction.sourceElement && !transaction.sourceElement.isConnected) ||
      (transaction.owner && !this.#ownerIsCurrent(transaction.owner))
    ) throw new CancelledCollectionError();
  }

  #ownerIsCurrent(owner: SceneOwner): boolean {
    return Boolean(
      this.#scene &&
      this.#scene.sceneId === owner.sceneId &&
      this.#scene.runId === owner.runId &&
      this.#scene.phase !== "exiting",
    );
  }

  #scopeId(transaction: ActiveTransaction): string | undefined {
    return transaction.owner
      ? createSceneAudioScopeId(transaction.owner.sceneId, transaction.owner.runId)
      : undefined;
  }

  #trackAudio(transaction: ActiveTransaction, promise: Promise<AudioHandle | null>): void {
    void promise.then((handle) => {
      if (!handle) return;
      if (transaction.controller.signal.aborted || this.#active?.id !== transaction.id) {
        handle.stop({ fadeSeconds: 0.05 });
      } else {
        transaction.audio.add(handle);
      }
    }).catch(() => undefined);
  }

  #playSpawnAudio(transaction: ActiveTransaction, variant: CollectionVariant): void {
    if (variant === "SILENT") return;
    this.#trackAudio(transaction, this.#audio.playSfx("audio:global.soulSpawn", {
      scopeId: this.#scopeId(transaction),
      gain: variant === "DEEP" ? 0.58 : 0.82,
      playbackRate: variant === "DEEP" ? 0.88 : 1,
    }));
  }

  #playFlyAudio(transaction: ActiveTransaction, variant: CollectionVariant): void {
    if (variant === "SILENT") return;
    this.#trackAudio(transaction, this.#audio.playSfx("audio:global.soulFly", {
      scopeId: this.#scopeId(transaction),
      gain: variant === "DEEP" ? 0.5 : 0.72,
      playbackRate: variant === "DEEP" ? 0.9 : 1,
    }));
  }

  #playVoiceAudio(
    transaction: ActiveTransaction,
    variant: CollectionVariant,
    voice: SoulVoice,
  ): void {
    if (variant === "SILENT" || voice === "NONE") return;
    this.#trackAudio(transaction, this.#audio.playVoiceLine(voice, {
      scopeId: this.#scopeId(transaction),
      gain: variant === "DEEP" ? 0.62 : 0.82,
      playbackRate: variant === "DEEP" ? 0.94 : 1,
      duckMusic: {
        to: 0.55,
        attackSeconds: 0.15,
        holdSeconds: 1.1,
        releaseSeconds: 0.7,
      },
    }));
  }

  #absorbSlot(soulId: SoulId, duration: number, signal: AbortSignal): Promise<boolean> {
    const element = this.#slotElements.get(soulId);
    if (!element || signal.aborted) return Promise.resolve(false);
    element.dataset.absorbing = "true";
    if (typeof element.animate !== "function") {
      return wait(duration, signal).finally(() => delete element.dataset.absorbing);
    }
    const animation = element.animate(
      [
        { transform: "scale(1)", filter: "brightness(1)" },
        { transform: "scale(1.65)", filter: "brightness(2.2) drop-shadow(0 0 8px #de2440)" },
        { transform: "scale(1)", filter: "brightness(1.15)" },
      ],
      { duration: duration * 1000, easing: "cubic-bezier(.22,.8,.28,1)" },
    );
    return new Promise((resolve) => {
      const abort = () => animation.cancel();
      signal.addEventListener("abort", abort, { once: true });
      animation.finished.then(
        () => resolve(true),
        () => resolve(false),
      ).finally(() => {
        signal.removeEventListener("abort", abort);
        delete element.dataset.absorbing;
      });
    });
  }

  #cleanupTransaction(
    transaction: ActiveTransaction,
    restoreSource: boolean,
    stopAudio = true,
  ): void {
    transaction.overlay?.cleanup(restoreSource);
    transaction.particle?.dispose();
    transaction.soul?.dispose();
    if (stopAudio) {
      for (const handle of transaction.audio) {
        if (handle.isActive()) handle.stop({ fadeSeconds: 0.08 });
      }
    }
    transaction.audio.clear();
  }

  #result(
    status: CollectionResult["status"],
    soulId: SoulId,
    reason?: string,
  ): CollectionResult {
    return { status, soulId, count: deriveSoulCount(this.#state), reason };
  }

  async releaseAllForRequiem(): Promise<ReleaseResult> {
    const count = deriveSoulCount(this.#state);
    if (this.#active) return { status: "busy", count, releasedCount: this.#released.length };
    if (this.#state.releaseState === "RELEASED") {
      return { status: "already-released", count, releasedCount: this.#released.length };
    }
    if (count !== this.#state.slots.length) {
      return { status: "incomplete", count, releasedCount: 0 };
    }
    const targets = this.#state.slots.map((slot) => ({
      slot,
      center: this.getSlotCenter(slot.soulId),
    }));
    if (targets.some((target) => !target.center)) {
      return { status: "failed", count, releasedCount: 0 };
    }

    this.#state = beginSoulRelease(this.#state);
    this.#visual.activateScope(RELEASE_SCOPE_ID);
    this.#notify();
    const created: ReleasedSoul[] = [];
    try {
      for (const { slot, center } of targets) {
        const point = center as readonly [number, number];
        const world = this.#visual.screenToWorld(point[0], point[1]);
        if (!world) throw new Error("Unable to convert a HUD slot to world space.");
        const controller = this.#visual.createSoul({
          position: world,
          scale: 0.48,
          state: slot.visualState ?? "ACTIVE",
          scopeId: RELEASE_SCOPE_ID,
        });
        created.push({ soulId: slot.soulId, slotIndex: slot.slotIndex, controller });
      }
      this.#released = created;
      this.#state = commitSoulRelease(this.#state);
      this.#notify();
      return { status: "released", count, releasedCount: created.length };
    } catch (error) {
      for (const released of created) released.controller.dispose();
      this.#released = [];
      this.#visual.cleanupScope(RELEASE_SCOPE_ID);
      this.#state = abortSoulRelease(this.#state);
      this.#notify();
      if (process.env.NODE_ENV === "development") {
        console.warn("Unable to release collected Souls.", error);
      }
      return { status: "failed", count, releasedCount: 0 };
    }
  }

  getReleasedSouls(): readonly ReleasedSoul[] {
    return [...this.#released];
  }

  disposeReleasedSouls(): void {
    for (const released of this.#released) released.controller.dispose();
    this.#released = [];
    this.#visual.cleanupScope(RELEASE_SCOPE_ID);
    this.#notify();
  }

  seedCollectedSouls(count: number): void {
    if (process.env.NODE_ENV !== "development") return;
    this.cancelActiveCollection("debug seed");
    this.disposeReleasedSouls();
    this.#state = seedSoulCollection(count);
    this.#notify();
  }

  resetSoulCollection(): void {
    this.cancelActiveCollection("collection reset");
    this.disposeReleasedSouls();
    this.#state = createInitialSoulCollectionState();
    this.#notify();
  }

  dispose(): void {
    this.resetSoulCollection();
    this.#listeners.clear();
    this.#slotElements.clear();
  }
}

export { TIMINGS as SOUL_COLLECTION_TIMINGS };
