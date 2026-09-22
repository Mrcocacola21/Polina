import gsap from "gsap";
import type { Camera } from "three";

import { screenToWorld, worldToScreen } from "./coordinates";
import {
  DEFAULT_VISUAL_QUALITY,
  VISUAL_QUALITY,
  type VisualQuality,
} from "./quality";
import type {
  CursorMode,
  FogVariant,
  ParticleFieldOptions,
  ParticleMode,
  SoulCreateOptions,
  SoulState,
  TransitionType,
  Vec3,
  VisualFxState,
  VisualMetrics,
} from "./types";
import { VisualScope } from "./VisualScope";

export type SoulRecord = {
  id: string;
  scopeId?: string;
  state: SoulState;
  position: [number, number, number];
  baseScale: number;
  scale: number;
  opacity: number;
  glow: number;
  aura: number;
  visible: boolean;
  breathing: boolean;
  breathAmount: number;
  stateWeights: { DORMANT: number; ACTIVE: number; CHARGED: number };
  flight?: {
    start: Vec3;
    control: Vec3;
    end: Vec3;
    progress: number;
    trail: boolean;
  };
  orbit?: {
    center: Vec3;
    radius: number;
    speed: number;
    phase: number;
    plane: "XY" | "XZ" | "YZ";
    startedAt: number;
  };
  trail: Array<[number, number, number]>;
  trailOpacity: number;
  trailWidth: number;
};

export type ParticleFieldRecord = {
  id: string;
  scopeId?: string;
  mode: ParticleMode;
  count: number;
  position: [number, number, number];
  spread: [number, number, number];
  size: [number, number];
  opacity: number;
  velocity: number;
  drift: number;
  lifetime: number;
  fade: number;
  attraction: [number, number, number];
  color: string;
  depthRange: [number, number];
  createdAt: number;
  seed: number;
  disposed: boolean;
};

type CameraBridge = {
  camera: Camera;
  width: number;
  height: number;
};

type AnimationHandle = { kill: () => void };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export class SoulController {
  readonly id: string;
  readonly #runtime: VisualRuntime;
  readonly #animations = new Set<AnimationHandle>();
  #disposed = false;

  constructor(runtime: VisualRuntime, id: string) {
    this.#runtime = runtime;
    this.id = id;
  }

  get disposed(): boolean {
    return this.#disposed;
  }

  #record(): SoulRecord | undefined {
    return this.#runtime.souls.get(this.id);
  }

  #animate(target: object, vars: gsap.TweenVars): Promise<boolean> {
    if (this.#disposed) return Promise.resolve(false);
    return new Promise((resolve) => {
      let settled = false;
      const finish = (completed: boolean) => {
        if (settled) return;
        settled = true;
        this.#animations.delete(handle);
        resolve(completed && !this.#disposed);
      };
      const handle: AnimationHandle = {
        kill: () => {
          tween.kill();
          finish(false);
        },
      };
      const tween = gsap.to(target, {
        ...vars,
        onComplete: () => finish(true),
        onInterrupt: () => finish(false),
      });
      this.#animations.add(handle);
    });
  }

  async setState(state: SoulState, duration = 0.55): Promise<boolean> {
    const record = this.#record();
    if (!record) return false;
    record.state = state;
    const completed = await this.#animate(record.stateWeights, {
      DORMANT: state === "DORMANT" ? 1 : 0,
      ACTIVE: state === "ACTIVE" ? 1 : 0,
      CHARGED: state === "CHARGED" ? 1 : 0,
      duration: duration * this.#runtime.motionIntensity,
      ease: "power2.inOut",
    });
    this.#runtime.notify();
    return completed;
  }

  async spawn(options: Readonly<{
    duration?: number;
    position?: Vec3;
    scale?: number;
    state?: SoulState;
  }> = {}): Promise<boolean> {
    const record = this.#record();
    if (!record) return false;
    this.cancelAnimations();
    record.visible = true;
    record.opacity = 0;
    record.scale = 0.04;
    record.position = [...(options.position ?? record.position)];
    record.baseScale = options.scale ?? record.baseScale;
    const finalState = options.state ?? "ACTIVE";
    void this.setState(finalState, (options.duration ?? 1.35) * 0.55);
    const gather = this.#runtime.spawnParticleField({
      mode: "ATTRACT",
      count: 90,
      position: record.position,
      spread: [2.5, 2.5, 1],
      attraction: record.position,
      lifetime: options.duration ?? 1.35,
      opacity: 0.7,
      scopeId: record.scopeId,
    });
    const completed = await this.#animate(record, {
      opacity: 1,
      scale: record.baseScale,
      glow: 0.75,
      duration: (options.duration ?? 1.35) * this.#runtime.motionIntensity,
      ease: "power3.out",
    });
    gather.dispose();
    return completed;
  }

  startBreathing(amount = 0.035): void {
    const record = this.#record();
    if (!record) return;
    record.breathAmount = Math.min(0.1, Math.max(0, amount));
    record.breathing = true;
    this.#runtime.notify();
  }

  stopBreathing(): void {
    const record = this.#record();
    if (!record) return;
    record.breathing = false;
    this.#runtime.notify();
  }

  async charge(options: Readonly<{ duration?: number; intensity?: number }> = {}): Promise<boolean> {
    const record = this.#record();
    if (!record) return false;
    const duration = options.duration ?? 1.1;
    const intensity = Math.max(0.5, options.intensity ?? 1);
    const aura = this.#runtime.spawnParticleField({
      mode: "ORBIT",
      count: 110,
      position: record.position,
      spread: [1.5, 1.5, 0.8],
      velocity: 0.7 * intensity,
      lifetime: duration + 0.4,
      opacity: 0.8,
      scopeId: record.scopeId,
    });
    const [stateChanged, charged] = await Promise.all([
      this.setState("CHARGED", duration * 0.8),
      this.#animate(record, {
        glow: 1.6 * intensity,
        aura: 1.4 * intensity,
        scale: record.baseScale * (1 + 0.08 * intensity),
        duration: duration * this.#runtime.motionIntensity,
        ease: "power2.inOut",
      }),
    ]);
    aura.dispose();
    return stateChanged && charged;
  }

  async flyTo(
    destination: Vec3 | Readonly<{ screen: readonly [number, number]; z?: number }>,
    options: Readonly<{
      duration?: number;
      curve?: number;
      trail?: boolean;
      scale?: number;
    }> = {},
  ): Promise<boolean> {
    const record = this.#record();
    if (!record) return false;
    const end = "screen" in destination
      ? this.#runtime.screenToWorld(destination.screen[0], destination.screen[1], destination.z)
      : destination;
    if (!end) return false;
    const start: Vec3 = [...record.position];
    const curve = options.curve ?? 1.6;
    const control: Vec3 = [
      (start[0] + end[0]) / 2 + curve,
      (start[1] + end[1]) / 2 + Math.abs(curve) * 0.7,
      (start[2] + end[2]) / 2,
    ];
    record.trail.length = 0;
    record.trailOpacity = options.trail === false ? 0 : 1;
    record.flight = { start, control, end, progress: 0, trail: options.trail !== false };
    const duration = (options.duration ?? 1.4) * this.#runtime.motionIntensity;
    const animations = [this.#animate(record.flight, {
      progress: 1,
      duration,
      ease: "power2.inOut",
    })];
    if (typeof options.scale === "number") {
      animations.push(this.#animate(record, {
        scale: options.scale,
        duration,
        ease: "power2.in",
      }));
    }
    const completed = (await Promise.all(animations)).every(Boolean);
    if (record.flight) record.position = [...end];
    record.flight = undefined;
    if (typeof options.scale === "number") record.baseScale = options.scale;
    void this.#animate(record, { trailOpacity: 0, duration: 0.45, ease: "power1.out" });
    return completed;
  }

  startOrbit(options: Readonly<{
    center?: Vec3;
    radius?: number;
    speed?: number;
    phase?: number;
    plane?: "XY" | "XZ" | "YZ";
  }> = {}): void {
    const record = this.#record();
    if (!record) return;
    record.orbit = {
      center: options.center ?? [0, 0, 0],
      radius: options.radius ?? 2.3,
      speed: options.speed ?? 0.55,
      phase: options.phase ?? 0,
      plane: options.plane ?? "XY",
      startedAt: performance.now() / 1000,
    };
    this.#runtime.notify();
  }

  stopOrbit(): void {
    const record = this.#record();
    if (!record) return;
    record.orbit = undefined;
    this.#runtime.notify();
  }

  async dissolve(options: Readonly<{ duration?: number }> = {}): Promise<boolean> {
    const record = this.#record();
    if (!record) return false;
    record.orbit = undefined;
    this.#runtime.spawnParticleField({
      mode: "DISSOLVE",
      count: 130,
      position: record.position,
      spread: [0.7, 0.7, 0.5],
      velocity: 0.9,
      lifetime: options.duration ?? 1.1,
      opacity: 0.85,
      scopeId: record.scopeId,
    });
    const completed = await this.#animate(record, {
      opacity: 0,
      glow: 0,
      aura: 0,
      scale: record.scale * 1.22,
      duration: (options.duration ?? 1.1) * this.#runtime.motionIntensity,
      ease: "power2.in",
    });
    record.visible = false;
    this.#runtime.notify();
    return completed;
  }

  cancelAnimations(): void {
    for (const animation of [...this.#animations]) animation.kill();
    this.#animations.clear();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.cancelAnimations();
    this.#runtime.removeSoul(this.id);
  }
}

export class ParticleFieldController {
  readonly id: string;
  readonly #runtime: VisualRuntime;
  #disposed = false;

  constructor(runtime: VisualRuntime, id: string) {
    this.#runtime = runtime;
    this.id = id;
  }

  update(options: Partial<ParticleFieldOptions>): void {
    const field = this.#runtime.particleFields.get(this.id);
    if (!field || this.#disposed) return;
    if (options.mode) field.mode = options.mode;
    if (options.position) field.position = [...options.position];
    if (options.spread) field.spread = [...options.spread];
    if (options.attraction) field.attraction = [...options.attraction];
    if (typeof options.opacity === "number") field.opacity = options.opacity;
    if (typeof options.velocity === "number") field.velocity = options.velocity;
    if (typeof options.drift === "number") field.drift = options.drift;
    this.#runtime.notify();
  }

  attract(target: Vec3): void {
    this.update({ mode: "ATTRACT", attraction: target });
  }

  burst(): void {
    this.update({ mode: "BURST" });
  }

  dissolve(): void {
    this.update({ mode: "DISSOLVE" });
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.#runtime.removeParticleField(this.id);
  }
}

export class VisualRuntime {
  readonly souls = new Map<string, SoulRecord>();
  readonly particleFields = new Map<string, ParticleFieldRecord>();
  readonly pointer = {
    raw: { x: 0, y: 0 },
    smoothed: { x: 0, y: 0 },
  };
  motionIntensity = 1;
  quality: VisualQuality = DEFAULT_VISUAL_QUALITY;
  #listeners = new Set<() => void>();
  #revision = 0;
  #nextId = 1;
  #scopes = new Map<string, VisualScope>();
  #soulControllers = new Map<string, SoulController>();
  #particleControllers = new Map<string, ParticleFieldController>();
  #camera?: CameraBridge;
  #transitionElement?: HTMLElement;
  #transitionTween?: gsap.core.Tween;
  #transitionResolver?: (completed: boolean) => void;
  #fogTimer?: ReturnType<typeof setTimeout>;
  #webgl: VisualMetrics["webgl"] = "initializing";
  #dpr = 1;
  #viewport: [number, number] = [0, 0];
  #pointerType: VisualMetrics["pointerType"] = "unknown";
  #fx: VisualFxState = {
    fog: null,
    fogOpacity: 0,
    fogDuration: 0.7,
    grain: 0.055,
    vignette: 0.42,
    vignetteSoftness: 0.62,
    vignetteCenter: [50, 50],
    lightLeak: 0,
    lightLeakScale: 1,
    lightLeakPosition: [50, 50],
    lightLeakRotation: 0,
    lightLeakDrift: false,
    cursor: "DEFAULT",
    transitionType: "FADE",
    transitionState: "idle",
  };

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  readonly getRevision = (): number => this.#revision;

  notify(): void {
    this.#revision += 1;
    for (const listener of this.#listeners) listener();
  }

  get fx(): VisualFxState {
    return this.#fx;
  }

  get dprCap(): number {
    return VISUAL_QUALITY[this.quality].dprCap;
  }

  get particleScale(): number {
    return VISUAL_QUALITY[this.quality].particleScale;
  }

  getSnapshot(): VisualMetrics {
    let particles = 0;
    for (const field of this.particleFields.values()) particles += field.count;
    let trails = 0;
    for (const soul of this.souls.values()) {
      if (soul.trailOpacity > 0 && soul.trail.length > 1) trails += 1;
    }
    return {
      webgl: this.#webgl,
      dpr: this.#dpr,
      viewport: this.#viewport,
      souls: this.souls.size,
      particleSystems: this.particleFields.size,
      particles,
      trails,
      fog: this.#fx.fog,
      transition: this.#fx.transitionState,
      scopes: this.#scopes.size,
      cursor: this.#fx.cursor,
      pointerType: this.#pointerType,
      quality: this.quality,
    };
  }

  setQuality(quality: VisualQuality): void {
    this.quality = quality;
    this.notify();
  }

  setMotionIntensity(intensity: number): void {
    this.motionIntensity = clamp01(intensity);
    this.notify();
  }

  activateScope(scopeId: string): VisualScope {
    const existing = this.#scopes.get(scopeId);
    if (existing) return existing;
    const scope = new VisualScope(scopeId);
    this.#scopes.set(scopeId, scope);
    this.notify();
    return scope;
  }

  cleanupScope(scopeId: string): void {
    const scope = this.#scopes.get(scopeId);
    if (!scope) return;
    scope.dispose();
    this.#scopes.delete(scopeId);
    this.notify();
  }

  addScopeCleanup(scopeId: string, cleanup: () => void): () => void {
    return this.activateScope(scopeId).add(cleanup);
  }

  createSoul(options: SoulCreateOptions = {}): SoulController {
    const id = `soul-${this.#nextId++}`;
    const state = options.state ?? "ACTIVE";
    const record: SoulRecord = {
      id,
      scopeId: options.scopeId,
      state,
      position: [...(options.position ?? [0, 0, 0])],
      baseScale: options.scale ?? 1,
      scale: options.scale ?? 1,
      opacity: 1,
      glow: state === "CHARGED" ? 1.5 : 0.75,
      aura: state === "CHARGED" ? 1.2 : 0.55,
      visible: true,
      breathing: false,
      breathAmount: 0.035,
      stateWeights: {
        DORMANT: state === "DORMANT" ? 1 : 0,
        ACTIVE: state === "ACTIVE" ? 1 : 0,
        CHARGED: state === "CHARGED" ? 1 : 0,
      },
      trail: [],
      trailOpacity: 0,
      trailWidth: 0.12,
    };
    const controller = new SoulController(this, id);
    this.souls.set(id, record);
    this.#soulControllers.set(id, controller);
    if (options.scopeId) this.activateScope(options.scopeId).add(() => controller.dispose());
    this.notify();
    return controller;
  }

  removeSoul(id: string): void {
    this.souls.delete(id);
    this.#soulControllers.delete(id);
    this.notify();
  }

  spawnParticleField(options: ParticleFieldOptions = {}): ParticleFieldController {
    const id = `particles-${this.#nextId++}`;
    const requestedCount = options.count ?? 220;
    const count = Math.max(1, Math.round(requestedCount * this.particleScale));
    const field: ParticleFieldRecord = {
      id,
      scopeId: options.scopeId,
      mode: options.mode ?? "AMBIENT_DRIFT",
      count,
      position: [...(options.position ?? [0, 0, 0])],
      spread: [...(options.spread ?? [8, 5, 3])],
      size: [...(options.size ?? [0.06, 0.2])],
      opacity: clamp01(options.opacity ?? 0.55),
      velocity: options.velocity ?? 0.35,
      drift: options.drift ?? 0.3,
      lifetime: options.lifetime ?? 0,
      fade: options.fade ?? 0.3,
      attraction: [...(options.attraction ?? [0, 0, 0])],
      color: options.color ?? "#de2440",
      depthRange: [...(options.depthRange ?? [-2, 2])],
      createdAt: performance.now() / 1000,
      seed: this.#nextId * 997,
      disposed: false,
    };
    const controller = new ParticleFieldController(this, id);
    this.particleFields.set(id, field);
    this.#particleControllers.set(id, controller);
    if (options.scopeId) this.activateScope(options.scopeId).add(() => controller.dispose());
    this.notify();
    return controller;
  }

  removeParticleField(id: string): void {
    const field = this.particleFields.get(id);
    if (field) field.disposed = true;
    this.particleFields.delete(id);
    this.#particleControllers.delete(id);
    this.notify();
  }

  clearTemporaryVisuals(): void {
    for (const controller of [...this.#soulControllers.values()]) controller.dispose();
    for (const controller of [...this.#particleControllers.values()]) controller.dispose();
    for (const scopeId of [...this.#scopes.keys()]) this.cleanupScope(scopeId);
  }

  setFog(variant: FogVariant | null, opacity = variant ? 0.55 : 0, duration = 0.7): void {
    if (this.#fogTimer) clearTimeout(this.#fogTimer);
    this.#fogTimer = undefined;
    this.#fx = { ...this.#fx, fog: variant, fogOpacity: clamp01(opacity), fogDuration: duration };
    this.notify();
  }

  hideFog(duration = 0.5): void {
    if (!this.#fx.fog) return;
    if (this.#fogTimer) clearTimeout(this.#fogTimer);
    this.#fx = { ...this.#fx, fogOpacity: 0, fogDuration: duration };
    this.notify();
    this.#fogTimer = setTimeout(() => {
      this.#fogTimer = undefined;
      this.#fx = { ...this.#fx, fog: null };
      this.notify();
    }, duration * 1000);
  }

  setFogOpacity(opacity: number, duration = 0.45): void {
    this.#fx = { ...this.#fx, fogOpacity: clamp01(opacity), fogDuration: duration };
    this.notify();
  }

  fadeFog(opacity: number, duration = 0.7): void {
    if (opacity <= 0) this.hideFog(duration);
    else this.setFogOpacity(opacity, duration);
  }

  setGrain(intensity: number): void {
    this.#fx = { ...this.#fx, grain: clamp01(intensity) };
    this.notify();
  }

  setVignette(strength: number, softness = this.#fx.vignetteSoftness): void {
    this.#fx = { ...this.#fx, vignette: clamp01(strength), vignetteSoftness: clamp01(softness) };
    this.notify();
  }

  setVignetteCenter(x: number, y: number): void {
    this.#fx = { ...this.#fx, vignetteCenter: [x, y] };
    this.notify();
  }

  setLightLeak(opacity: number, options: Readonly<{
    scale?: number;
    position?: readonly [number, number];
    rotation?: number;
    drift?: boolean;
  }> = {}): void {
    this.#fx = {
      ...this.#fx,
      lightLeak: clamp01(opacity),
      lightLeakScale: options.scale ?? this.#fx.lightLeakScale,
      lightLeakPosition: options.position ?? this.#fx.lightLeakPosition,
      lightLeakRotation: options.rotation ?? this.#fx.lightLeakRotation,
      lightLeakDrift: options.drift ?? opacity > 0,
    };
    this.notify();
  }

  setCursorMode(cursor: CursorMode): void {
    this.#fx = { ...this.#fx, cursor };
    this.notify();
  }

  setPointerType(pointerType: VisualMetrics["pointerType"]): void {
    if (this.#pointerType === pointerType) return;
    this.#pointerType = pointerType;
    this.notify();
  }

  registerTransitionElement(element?: HTMLElement): void {
    this.#transitionElement = element;
  }

  async cover(type: TransitionType, duration = 0.9): Promise<boolean> {
    return this.#runTransition(type, 1, duration, "covering", "covered");
  }

  async reveal(type: TransitionType, duration = 0.9): Promise<boolean> {
    return this.#runTransition(type, 0, duration, "revealing", "idle");
  }

  async transition(type: TransitionType, duration = 0.9): Promise<boolean> {
    const covered = await this.cover(type, duration);
    if (!covered) return false;
    return this.reveal(type, duration);
  }

  cancelTransition(): void {
    this.#transitionTween?.kill();
    this.#transitionTween = undefined;
    this.#transitionResolver?.(false);
    this.#transitionResolver = undefined;
    if (this.#transitionElement) {
      gsap.set(this.#transitionElement, { opacity: 0 });
    }
    this.#fx = { ...this.#fx, transitionState: "idle" };
    this.notify();
  }

  #runTransition(
    type: TransitionType,
    opacity: number,
    duration: number,
    during: VisualMetrics["transition"],
    after: VisualMetrics["transition"],
  ): Promise<boolean> {
    if (this.#transitionTween) {
      this.#transitionTween.kill();
      this.#transitionTween = undefined;
      this.#transitionResolver?.(false);
      this.#transitionResolver = undefined;
    }
    const element = this.#transitionElement;
    this.#fx = { ...this.#fx, transitionType: type, transitionState: during };
    this.notify();
    if (!element) {
      this.#fx = { ...this.#fx, transitionState: after };
      this.notify();
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      this.#transitionResolver = resolve;
      this.#transitionTween = gsap.to(element, {
        opacity,
        duration: duration * this.motionIntensity,
        ease: "power2.inOut",
        onComplete: () => {
          this.#transitionTween = undefined;
          this.#transitionResolver = undefined;
          this.#fx = { ...this.#fx, transitionState: after };
          this.notify();
          resolve(true);
        },
        onInterrupt: () => resolve(false),
      });
    });
  }

  setCameraBridge(camera: Camera, width: number, height: number): void {
    this.#camera = { camera, width, height };
  }

  screenToWorld(x: number, y: number, z = 0): Vec3 | undefined {
    if (!this.#camera) return undefined;
    return screenToWorld(x, y, this.#camera.camera, this.#camera.width, this.#camera.height, z);
  }

  worldToScreen(position: Vec3): readonly [number, number] | undefined {
    if (!this.#camera) return undefined;
    return worldToScreen(position, this.#camera.camera, this.#camera.width, this.#camera.height);
  }

  setWebGLState(
    webgl: VisualMetrics["webgl"],
    dpr = this.#dpr,
    viewport: readonly [number, number] = this.#viewport,
  ): void {
    this.#webgl = webgl;
    this.#dpr = dpr;
    this.#viewport = [...viewport];
    this.notify();
  }

  reset(): void {
    if (this.#fogTimer) clearTimeout(this.#fogTimer);
    this.#fogTimer = undefined;
    this.clearTemporaryVisuals();
    this.cancelTransition();
    this.#fx = {
      ...this.#fx,
      fog: null,
      fogOpacity: 0,
      grain: 0.055,
      vignette: 0.42,
      vignetteSoftness: 0.62,
      lightLeak: 0,
      lightLeakDrift: false,
      cursor: "DEFAULT",
      transitionType: "FADE",
      transitionState: "idle",
    };
    this.notify();
  }

  dispose(): void {
    this.reset();
    this.#listeners.clear();
    this.#camera = undefined;
    this.#transitionElement = undefined;
  }
}
