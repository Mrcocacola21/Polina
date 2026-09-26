import { loadAudioCatalog, type AudioCatalog } from "./catalog";
import { AsyncDecodeCache } from "./buffers";
import { DuckRegistry } from "./ducking";
import {
  clamp,
  clampGain,
  clampPan,
  clampPlaybackRate,
  clampVolume,
  rampGain,
  setParamSmooth,
} from "./scheduling";
import { AudioScopeRegistry } from "./scopes";
import type {
  AmbientHandle,
  AmbientOptions,
  AmbientState,
  AudioAnalysis,
  AudioBusName,
  AudioEngineSnapshot,
  AudioLevels,
  AudioScopeId,
  DuckHandle,
  DuckOptions,
  EngineContextState,
  FilteredNoiseOptions,
  LowRumbleOptions,
  MusicOptions,
  MusicState,
  MusicToneHandle,
  MusicToneOptions,
  ProceduralHandle,
  PulseHandle,
  RatingRiseOptions,
  SfxHandle,
  SfxOptions,
  SoulHumOptions,
  StopOptions,
  UiToneOptions,
  UnlockAudioResult,
  VoiceLineId,
  VolumeName,
} from "./types";
import type { MediaAsset } from "../media/types";

export const DEFAULT_AUDIO_LEVELS: AudioLevels = Object.freeze({
  master: 1,
  music: 0.7,
  ambient: 0.45,
  sfx: 0.85,
  procedural: 0.5,
});

const DEFAULT_CROSSFADE_SECONDS = 2;
const DEFAULT_STOP_FADE_SECONDS = 0.15;
const MUTE_RAMP_SECONDS = 0.03;
export const AUDIO_PREFERENCE_KEY = "soulbound.audio.v1";

type BusGraph = Readonly<{
  level: GainNode;
  duck: GainNode;
}>;

type MusicDeck = {
  readonly name: "A" | "B";
  readonly element: HTMLAudioElement;
  readonly source: MediaElementAudioSourceNode;
  readonly gain: GainNode;
  targetGain: number;
  state: MusicState | null;
  asset: MediaAsset | null;
  requestToken: number;
};

type AmbientEntry = {
  readonly handle: AmbientHandle;
  readonly element: HTMLAudioElement;
  readonly source: MediaElementAudioSourceNode;
  readonly gain: GainNode;
};

function createId(prefix: string, value: number): string {
  return `${prefix}-${value}`;
}

function normalizedSeconds(value: number | undefined, fallback: number): number {
  return clamp(value ?? fallback, 0, 30);
}

export class AudioEngine {
  readonly #listeners = new Set<() => void>();
  readonly #levels: Record<VolumeName, number> = { ...DEFAULT_AUDIO_LEVELS };
  readonly #scopes = new AudioScopeRegistry();
  readonly #ducks = new DuckRegistry();
  readonly #decodedBuffers = new AsyncDecodeCache<AudioBuffer>();
  readonly #ambient = new Map<string, AmbientEntry>();
  readonly #sfx = new Map<string, SfxHandle>();
  readonly #procedural = new Map<string, ProceduralHandle>();
  readonly #duckTimers = new Map<string, number>();
  #catalogPromise: Promise<AudioCatalog> | null = null;
  #context: AudioContext | null = null;
  #contextCreationCount = 0;
  #unlockPromise: Promise<UnlockAudioResult> | null = null;
  #masterGain: GainNode | null = null;
  #muteGain: GainNode | null = null;
  #cinematicGain: GainNode | null = null;
  #buses: Record<AudioBusName, BusGraph> | null = null;
  #musicDecks: readonly [MusicDeck, MusicDeck] | null = null;
  #musicToneFilter: BiquadFilterNode | null = null;
  #musicPresenceGain: GainNode | null = null;
  #musicToneFrequency = 20_000;
  #musicTonePresence = 1;
  #musicToneSequence = 0;
  #activeMusicDeck: 0 | 1 | null = null;
  #musicTransition = 0;
  #musicTimer: number | null = null;
  #musicTicker: number | null = null;
  #noiseBuffer: AudioBuffer | null = null;
  #isMuted = false;
  #cinematicSilence = false;
  #cinematicSilenceScheduledAt: number | null = null;
  #sequence = 0;
  #revision = 0;
  #lastError: string | null = null;
  #audioUnavailable = false;
  #debugUnavailable = false;
  #mutePreferenceLoaded = false;
  #visibilitySuspended = false;
  #visibilityMusicWasPlaying = false;
  readonly #visibilityAmbientIds = new Set<string>();

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getRevision = (): number => this.#revision;

  getSnapshot(): AudioEngineSnapshot {
    const activeDeck =
      this.#activeMusicDeck === null
        ? null
        : this.#musicDecks?.[this.#activeMusicDeck] ?? null;
    const duration = activeDeck?.element.duration;

    return {
      contextState: this.#getContextState(),
      contextCreationCount: this.#contextCreationCount,
      isUnlocked: this.#context?.state === "running",
      isMuted: this.#isMuted,
      cinematicSilence: {
        active: this.#cinematicSilence,
        scheduledAt: this.#cinematicSilenceScheduledAt,
      },
      levels: { ...this.#levels },
      effectiveDucks: {
        music: this.#ducks.getTarget("music"),
        ambient: this.#ducks.getTarget("ambient"),
        sfx: this.#ducks.getTarget("sfx"),
        procedural: this.#ducks.getTarget("procedural"),
      },
      music: {
        state: activeDeck?.state ?? null,
        assetId: activeDeck?.asset?.id ?? null,
        deck: activeDeck?.name ?? null,
        gain: activeDeck?.targetGain ?? 0,
        playing: Boolean(activeDeck && !activeDeck.element.paused),
        paused: Boolean(activeDeck?.element.paused && activeDeck.state),
        currentTime: activeDeck?.element.currentTime ?? 0,
        duration:
          typeof duration === "number" && Number.isFinite(duration)
            ? duration
            : null,
      },
      musicTone: {
        frequency: this.#musicToneFrequency,
        presence: this.#musicTonePresence,
        active: this.#musicToneFrequency < 19_500 || this.#musicTonePresence < 0.995,
      },
      activeMusicDeckCount:
        this.#musicDecks?.filter((deck) => !deck.element.paused).length ?? 0,
      activeAmbientCount: this.#ambient.size,
      activeSfxCount: this.#sfx.size,
      activeProceduralCount: this.#procedural.size,
      activeScopeCount: this.#scopes.size,
      activeDuckCount: this.#ducks.size,
      decodedSfxCount: this.#decodedBuffers.size,
      lastError: this.#lastError,
    };
  }

  async unlockAudio(): Promise<UnlockAudioResult> {
    if (this.#debugUnavailable) {
      return { ok: false, state: "unavailable", error: "Audio is unavailable." };
    }
    if (this.#context?.state === "running") {
      return { ok: true, state: "running" };
    }
    if (this.#context?.state === "closed") {
      return {
        ok: false,
        state: "closed",
        error: "The SOULBOUND AudioContext has been closed.",
      };
    }
    if (this.#unlockPromise) return this.#unlockPromise;

    this.#unlockPromise = this.#performUnlock().finally(() => {
      this.#unlockPromise = null;
    });
    return this.#unlockPromise;
  }

  async #performUnlock(): Promise<UnlockAudioResult> {
    try {
      if (!this.#context) {
        const AudioContextConstructor = typeof window === "undefined"
          ? undefined
          : window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextConstructor) {
          this.#audioUnavailable = true;
          this.#notify();
          return {
            ok: false,
            state: "unavailable",
            error: "Web Audio API is unavailable.",
          };
        }
        this.#context = new AudioContextConstructor();
        this.#contextCreationCount += 1;
        this.#initializeGraph(this.#context);
        this.#context.addEventListener("statechange", this.#handleContextState);
      }

      if (
        this.#context.state !== "running" &&
        this.#context.state !== "closed"
      ) {
        await this.#context.resume();
      }
      const state = this.#getContextState();
      const ok = state === "running";
      if (!ok) this.#setError(`AudioContext did not enter running state (${state}).`);
      this.#notify();
      return ok
        ? { ok: true, state }
        : { ok: false, state, error: `AudioContext state is ${state}.` };
    } catch (error) {
      const message = this.#reportError("Audio unlock failed", error);
      return { ok: false, state: this.#getContextState(), error: message };
    }
  }

  readonly #handleContextState = (): void => this.#notify();

  setVolume(name: VolumeName, value: number): void {
    const normalized = clampVolume(value);
    this.#levels[name] = normalized;
    const context = this.#context;
    if (context) {
      const target =
        name === "master"
          ? this.#masterGain
          : this.#buses?.[name].level ?? null;
      if (target) rampGain(target, normalized, context);
    }
    this.#notify();
  }

  setMasterVolume(value: number): void {
    this.setVolume("master", value);
  }

  setMusicVolume(value: number): void {
    this.setVolume("music", value);
  }

  setAmbientVolume(value: number): void {
    this.setVolume("ambient", value);
  }

  setSfxVolume(value: number): void {
    this.setVolume("sfx", value);
  }

  setProceduralVolume(value: number): void {
    this.setVolume("procedural", value);
  }

  mute(): void {
    if (this.#isMuted) return;
    this.#isMuted = true;
    if (this.#context && this.#muteGain) {
      rampGain(this.#muteGain, 0, this.#context, MUTE_RAMP_SECONDS);
    }
    this.#notify();
    this.#persistMutePreference();
  }

  unmute(): void {
    if (!this.#isMuted) return;
    this.#isMuted = false;
    if (this.#context && this.#muteGain) {
      rampGain(this.#muteGain, 1, this.#context, MUTE_RAMP_SECONDS);
    }
    this.#notify();
    this.#persistMutePreference();
  }

  toggleMute(): void {
    if (this.#isMuted) this.unmute();
    else this.mute();
  }

  loadMutePreference(storage?: Pick<Storage, "getItem">): void {
    if (this.#mutePreferenceLoaded) return;
    this.#mutePreferenceLoaded = true;
    try {
      const source = storage ?? (typeof window !== "undefined" ? window.localStorage : undefined);
      if (!source) return;
      const value = source.getItem(AUDIO_PREFERENCE_KEY);
      if (!value) return;
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && (parsed as { version?: unknown }).version === 1) {
        this.#isMuted = (parsed as { muted?: unknown }).muted === true;
      }
    } catch {
      // Storage is optional; the in-memory preference remains authoritative.
    }
    this.#notify();
  }

  clearMutePreference(storage?: Pick<Storage, "removeItem">): void {
    try {
      (storage ?? (typeof window !== "undefined" ? window.localStorage : undefined))?.removeItem(AUDIO_PREFERENCE_KEY);
    } catch {
      // Storage denial must never affect playback logic.
    }
  }

  async suspendForVisibility(): Promise<boolean> {
    if (this.#visibilitySuspended) return true;
    this.#visibilitySuspended = true;
    const activeDeck = this.#activeMusicDeck === null ? null : this.#musicDecks?.[this.#activeMusicDeck];
    this.#visibilityMusicWasPlaying = Boolean(activeDeck && !activeDeck.element.paused);
    activeDeck?.element.pause();
    this.#visibilityAmbientIds.clear();
    for (const [id, entry] of this.#ambient) {
      if (!entry.element.paused) this.#visibilityAmbientIds.add(id);
      entry.element.pause();
    }
    this.#stopMusicTicker();
    try {
      if (this.#context?.state === "running") await this.#context.suspend();
      this.#notify();
      return true;
    } catch (error) {
      this.#reportError("Audio visibility suspension failed", error);
      return false;
    }
  }

  async resumeAfterVisibility(): Promise<boolean> {
    if (!this.#visibilitySuspended) return true;
    this.#visibilitySuspended = false;
    try {
      if (this.#context && this.#context.state !== "running" && this.#context.state !== "closed") {
        await this.#context.resume();
      }
      const tasks: Promise<unknown>[] = [];
      const activeDeck = this.#activeMusicDeck === null ? null : this.#musicDecks?.[this.#activeMusicDeck];
      if (this.#visibilityMusicWasPlaying && activeDeck) tasks.push(activeDeck.element.play());
      for (const id of this.#visibilityAmbientIds) {
        const entry = this.#ambient.get(id);
        if (entry) tasks.push(entry.element.play());
      }
      this.#visibilityAmbientIds.clear();
      this.#visibilityMusicWasPlaying = false;
      const results = await Promise.allSettled(tasks);
      if (activeDeck && !activeDeck.element.paused) this.#startMusicTicker();
      this.#notify();
      return results.every((result) => result.status === "fulfilled");
    } catch (error) {
      this.#reportError("Audio visibility resume failed", error);
      return false;
    }
  }

  setDevelopmentUnavailable(unavailable: boolean): void {
    if (process.env.NODE_ENV !== "development" || this.#debugUnavailable === unavailable) return;
    this.#debugUnavailable = unavailable;
    if (unavailable) {
      this.pauseMusic();
      for (const entry of this.#ambient.values()) entry.element.pause();
      this.stopAllSfx();
      this.stopAllProcedural();
    }
    this.#notify();
  }

  /** Current time of the one shared AudioContext, or null before unlock. */
  getCurrentTime(): number | null {
    return this.#context?.currentTime ?? null;
  }

  enterCinematicSilence(options: Readonly<{ atAudioTime?: number }> = {}): number | null {
    const context = this.#context;
    const gate = this.#cinematicGain;
    this.#cinematicSilence = true;
    if (!context || !gate) {
      this.#cinematicSilenceScheduledAt = null;
      this.#notify();
      return null;
    }
    const at = Math.max(context.currentTime, options.atAudioTime ?? context.currentTime);
    gate.gain.cancelScheduledValues(context.currentTime);
    gate.gain.setValueAtTime(gate.gain.value, context.currentTime);
    gate.gain.setValueAtTime(0, at);
    this.#cinematicSilenceScheduledAt = at;
    this.#notify();
    return at;
  }

  leaveCinematicSilence(): void {
    this.#cinematicSilence = false;
    this.#cinematicSilenceScheduledAt = null;
    if (this.#context && this.#cinematicGain) {
      this.#cinematicGain.gain.cancelScheduledValues(this.#context.currentTime);
      this.#cinematicGain.gain.setValueAtTime(1, this.#context.currentTime);
    }
    this.#notify();
  }

  applyMusicTone(options: MusicToneOptions = {}): MusicToneHandle | null {
    const context = this.#requireGraph("music tone");
    const filter = this.#musicToneFilter;
    const presence = this.#musicPresenceGain;
    if (!context || !filter || !presence || !this.#scopeAllows(options.scopeId)) {
      return null;
    }

    const frequency = clamp(options.frequency ?? 1600, 180, 20_000);
    const presenceValue = clampGain(options.presence ?? 0.78);
    const ramp = normalizedSeconds(options.rampSeconds, 0.8);
    const token = ++this.#musicToneSequence;
    const id = createId("music-tone", token);
    let active = true;
    let unregisterScope: () => void = () => undefined;
    this.#musicToneFrequency = frequency;
    this.#musicTonePresence = presenceValue;
    setParamSmooth(filter.frequency, frequency, context, ramp);
    rampGain(presence, presenceValue, context, ramp);

    const release = (rampSeconds = 0.8) => {
      if (!active) return;
      active = false;
      unregisterScope();
      if (token !== this.#musicToneSequence) return;
      this.resetMusicTone(rampSeconds);
    };
    const handle: MusicToneHandle = {
      id,
      isActive: () => active,
      release,
    };
    unregisterScope = this.#registerScopeCleanup(options.scopeId, () => release(0.65));
    this.#notify();
    return handle;
  }

  resetMusicTone(rampSeconds = 0.8): void {
    const context = this.#context;
    const filter = this.#musicToneFilter;
    const presence = this.#musicPresenceGain;
    ++this.#musicToneSequence;
    this.#musicToneFrequency = 20_000;
    this.#musicTonePresence = 1;
    if (context && filter && presence) {
      const ramp = normalizedSeconds(rampSeconds, 0.8);
      setParamSmooth(filter.frequency, 20_000, context, ramp);
      rampGain(presence, 1, context, ramp);
    }
    this.#notify();
  }

  activateScope(scopeId: AudioScopeId): void {
    this.#scopes.activate(scopeId);
    this.#notify();
  }

  cleanupScope(scopeId: AudioScopeId): void {
    this.#scopes.cleanup(scopeId);
    this.#notify();
  }

  isScopeActive(scopeId: AudioScopeId): boolean {
    return this.#scopes.isActive(scopeId);
  }

  async setMusicState(
    state: MusicState | null,
    options: MusicOptions = {},
  ): Promise<boolean> {
    if (!state) {
      this.stopMusic({ fadeSeconds: options.crossfadeSeconds });
      return true;
    }

    const graph = this.#requireGraph("music playback");
    if (!graph) return false;
    const decks = this.#musicDecks;
    if (!decks) return false;
    const current =
      this.#activeMusicDeck === null ? null : decks[this.#activeMusicDeck];

    const requestedGain = clamp(options.gain ?? current?.targetGain ?? 1, 0, 1);
    if (current?.state === state && !options.restart) {
      if (options.gain !== undefined) {
        current.targetGain = requestedGain;
        rampGain(
          current.gain,
          requestedGain,
          graph,
          normalizedSeconds(options.gainRampSeconds, 0.8),
        );
        this.#notify();
      }
      return true;
    }

    try {
      const catalog = await this.#getCatalog();
      const asset = catalog.getMusic(state);
      const nextIndex: 0 | 1 =
        this.#activeMusicDeck === null ? 0 : this.#activeMusicDeck === 0 ? 1 : 0;
      const incoming = decks[nextIndex];
      const transition = ++this.#musicTransition;
      const duration = normalizedSeconds(
        options.crossfadeSeconds,
        DEFAULT_CROSSFADE_SECONDS,
      );

      this.#clearMusicTimer();
      incoming.element.pause();
      incoming.element.src = asset.url;
      incoming.element.loop = options.loop ?? true;
      incoming.element.preload = "auto";
      incoming.element.currentTime = 0;
      incoming.state = state;
      incoming.asset = asset;
      incoming.requestToken = transition;
      incoming.targetGain = requestedGain;
      rampGain(incoming.gain, 0, graph, 0);

      try {
        await incoming.element.play();
      } catch (error) {
        if (transition !== this.#musicTransition) {
          return false;
        }
        if (transition === this.#musicTransition) {
          incoming.element.removeAttribute("src");
          incoming.element.load();
          incoming.state = null;
          incoming.asset = null;
        }
        this.#reportError(`Music play failed (${state})`, error);
        return false;
      }

      if (transition !== this.#musicTransition) {
        if (incoming.requestToken === transition) incoming.element.pause();
        return false;
      }

      const now = graph.currentTime;
      rampGain(incoming.gain, incoming.targetGain, graph, duration);
      if (current && current !== incoming) {
        rampGain(current.gain, 0, graph, duration);
      }
      this.#activeMusicDeck = nextIndex;
      this.#startMusicTicker();
      this.#notify();

      this.#musicTimer = window.setTimeout(() => {
        if (transition !== this.#musicTransition) return;
        if (current && current !== incoming) this.#resetDeck(current);
        incoming.gain.gain.setValueAtTime(incoming.targetGain, Math.max(now + duration, graph.currentTime));
        this.#musicTimer = null;
        this.#notify();
      }, duration * 1000 + 50);
      return true;
    } catch (error) {
      this.#reportError(`Music state failed (${state})`, error);
      return false;
    }
  }

  playMusic(state: MusicState, options?: MusicOptions): Promise<boolean> {
    return this.setMusicState(state, options);
  }

  crossfadeMusic(state: MusicState, options?: MusicOptions): Promise<boolean> {
    return this.setMusicState(state, options);
  }

  stopMusic(options: StopOptions = {}): void {
    const context = this.#context;
    const decks = this.#musicDecks;
    if (!context || !decks) return;
    const transition = ++this.#musicTransition;
    const duration = normalizedSeconds(
      options.fadeSeconds,
      DEFAULT_STOP_FADE_SECONDS,
    );
    this.#clearMusicTimer();
    for (const deck of decks) rampGain(deck.gain, 0, context, duration);
    this.#activeMusicDeck = null;
    this.#stopMusicTicker();
    this.#notify();
    this.#musicTimer = window.setTimeout(() => {
      if (transition !== this.#musicTransition) return;
      for (const deck of decks) this.#resetDeck(deck);
      this.#musicTimer = null;
      this.#notify();
    }, duration * 1000 + 50);
  }

  pauseMusic(): void {
    const deck =
      this.#activeMusicDeck === null
        ? null
        : this.#musicDecks?.[this.#activeMusicDeck];
    deck?.element.pause();
    this.#stopMusicTicker();
    this.#notify();
  }

  async resumeMusic(): Promise<boolean> {
    const deck =
      this.#activeMusicDeck === null
        ? null
        : this.#musicDecks?.[this.#activeMusicDeck];
    if (!deck) return false;
    try {
      await deck.element.play();
      this.#startMusicTicker();
      this.#notify();
      return true;
    } catch (error) {
      this.#reportError("Music resume failed", error);
      return false;
    }
  }

  async playAmbient(
    stateOrAssetId: AmbientState | string,
    options: AmbientOptions = {},
  ): Promise<AmbientHandle | null> {
    const context = this.#requireGraph("ambient playback");
    const bus = this.#buses?.ambient.level;
    if (!context || !bus || !this.#scopeAllows(options.scopeId)) return null;

    try {
      const catalog = await this.#getCatalog();
      const asset = stateOrAssetId.startsWith("media:")
        ? catalog.getById(stateOrAssetId)
        : catalog.getAmbient(stateOrAssetId as AmbientState);
      if (!catalog.isLongForm(asset)) {
        throw new Error(`Ambient asset is not classified as long-form: ${asset.id}`);
      }
      if (!this.#scopeAllows(options.scopeId)) return null;

      const id = createId("ambient", ++this.#sequence);
      const element = new Audio(asset.url);
      element.loop = options.loop ?? true;
      element.preload = "auto";
      element.playbackRate = clampPlaybackRate(options.playbackRate ?? 1);
      const source = context.createMediaElementSource(element);
      const gain = context.createGain();
      const targetGain = clampGain(options.gain ?? 1);
      gain.gain.setValueAtTime(0, context.currentTime);
      source.connect(gain).connect(bus);
      let active = true;
      let stopTimer: number | null = null;
      let unregisterScope: () => void = () => undefined;
      const finalize = () => {
        if (!active) return;
        active = false;
        unregisterScope();
        if (stopTimer !== null) window.clearTimeout(stopTimer);
        element.pause();
        element.removeAttribute("src");
        element.load();
        source.disconnect();
        gain.disconnect();
        this.#ambient.delete(id);
        this.#notify();
      };
      const handle: AmbientHandle = {
        id,
        kind: "ambient",
        isActive: () => active,
        stop: (stopOptions = {}) => {
          if (!active) return;
          const fade = normalizedSeconds(stopOptions.fadeSeconds, 0.12);
          rampGain(gain, 0, context, fade);
          if (fade === 0) finalize();
          else stopTimer = window.setTimeout(finalize, fade * 1000 + 30);
        },
        setGain: (value, rampSeconds = 0.03) =>
          rampGain(gain, clampGain(value), context, rampSeconds),
        setPlaybackRate: (value) => {
          element.playbackRate = clampPlaybackRate(value);
        },
      };
      element.addEventListener("ended", finalize, { once: true });
      this.#ambient.set(id, { handle, element, source, gain });
      unregisterScope = this.#registerScopeCleanup(options.scopeId, () =>
        handle.stop({ fadeSeconds: 0.08 }),
      );
      try {
        await element.play();
      } catch (error) {
        finalize();
        throw error;
      }
      if (!active || !this.#scopeAllows(options.scopeId)) {
        finalize();
        return null;
      }
      rampGain(
        gain,
        targetGain,
        context,
        normalizedSeconds(options.fadeInSeconds, 0.2),
      );
      this.#notify();
      return handle;
    } catch (error) {
      this.#reportError(`Ambient play failed (${stateOrAssetId})`, error);
      return null;
    }
  }

  stopAmbient(id: string, options?: StopOptions): void {
    this.#ambient.get(id)?.handle.stop(options);
  }

  stopAllAmbient(options?: StopOptions): void {
    for (const entry of [...this.#ambient.values()]) {
      entry.handle.stop(options);
    }
  }

  async playSfx(
    assetIdOrRef: string,
    options: SfxOptions = {},
  ): Promise<SfxHandle | null> {
    const context = this.#requireGraph("SFX playback");
    const bus = this.#buses?.sfx.level;
    if (!context || !bus || !this.#scopeAllows(options.scopeId)) return null;

    try {
      const catalog = await this.#getCatalog();
      const asset = assetIdOrRef.startsWith("audio:")
        ? catalog.getBySemanticRef(assetIdOrRef)
        : catalog.getById(assetIdOrRef);
      if (catalog.isLongForm(asset)) {
        throw new Error(`Long-form audio cannot use the decoded SFX path: ${asset.id}`);
      }
      const buffer = await this.#decodeSfx(asset);
      if (!this.#scopeAllows(options.scopeId)) return null;

      const id = createId("sfx", ++this.#sequence);
      const source = context.createBufferSource();
      const gain = context.createGain();
      const panner =
        typeof context.createStereoPanner === "function"
          ? context.createStereoPanner()
          : null;
      source.buffer = buffer;
      source.loop = options.loop ?? false;
      source.playbackRate.setValueAtTime(
        clampPlaybackRate(options.playbackRate ?? 1),
        context.currentTime,
      );
      gain.gain.setValueAtTime(clampGain(options.gain ?? 1), context.currentTime);
      if (panner) {
        panner.pan.setValueAtTime(clampPan(options.pan ?? 0), context.currentTime);
        source.connect(gain).connect(panner).connect(bus);
      } else {
        source.connect(gain).connect(bus);
      }

      let active = true;
      let stopping = false;
      let stopTimer: number | null = null;
      let duck: DuckHandle | null = null;
      let unregisterScope: () => void = () => undefined;
      const finalize = () => {
        if (!active) return;
        active = false;
        if (stopTimer !== null) window.clearTimeout(stopTimer);
        unregisterScope();
        duck?.release();
        source.disconnect();
        gain.disconnect();
        panner?.disconnect();
        this.#sfx.delete(id);
        this.#notify();
      };
      const handle: SfxHandle = {
        id,
        kind: "sfx",
        isActive: () => active,
        stop: (stopOptions = {}) => {
          if (!active || stopping) return;
          stopping = true;
          const fade = normalizedSeconds(stopOptions.fadeSeconds, 0);
          rampGain(gain, 0, context, fade);
          const stopSource = () => {
            if (!active) return;
            try {
              source.stop();
            } catch {
              finalize();
            }
          };
          if (fade === 0) stopSource();
          else stopTimer = window.setTimeout(stopSource, fade * 1000 + 10);
        },
        setGain: (value, rampSeconds = 0.03) =>
          rampGain(gain, clampGain(value), context, rampSeconds),
        setPan: (value, rampSeconds = 0.03) => {
          if (panner) {
            setParamSmooth(
              panner.pan,
              clampPan(value),
              context,
              rampSeconds,
            );
          }
        },
        setPlaybackRate: (value) =>
          setParamSmooth(
            source.playbackRate,
            clampPlaybackRate(value),
            context,
          ),
      };
      source.addEventListener("ended", finalize, { once: true });
      this.#sfx.set(id, handle);
      unregisterScope = this.#registerScopeCleanup(options.scopeId, () =>
        handle.stop(),
      );
      if (options.duckMusic) {
        duck = this.duckBus(
          "music",
          typeof options.duckMusic === "object"
            ? { ...options.duckMusic, scopeId: options.scopeId }
            : { scopeId: options.scopeId, holdSeconds: 0 },
        );
      }
      const requestedStart = typeof options.when === "number"
        ? options.when
        : context.currentTime + normalizedSeconds(options.delaySeconds, 0);
      source.start(Math.max(context.currentTime, requestedStart));
      this.#notify();
      return handle;
    } catch (error) {
      this.#reportError(`SFX play failed (${assetIdOrRef})`, error);
      return null;
    }
  }

  async playVoiceLine(
    voice: VoiceLineId,
    options: SfxOptions = {},
  ): Promise<SfxHandle | null> {
    try {
      const asset = (await this.#getCatalog()).getVoiceLine(voice);
      return this.playSfx(asset.id, {
        ...options,
        duckMusic: options.duckMusic ?? true,
      });
    } catch (error) {
      this.#reportError(`Voice line failed (${voice})`, error);
      return null;
    }
  }

  async playRequiem(options: SfxOptions = {}): Promise<SfxHandle | null> {
    try {
      const asset = (await this.#getCatalog()).getRequiem();
      return this.playSfx(asset.id, {
        ...options,
        duckMusic: options.duckMusic ?? {
          to: 0.25,
          attackSeconds: 0.12,
          holdSeconds: 5,
          releaseSeconds: 0.8,
        },
      });
    } catch (error) {
      this.#reportError("Requiem playback failed", error);
      return null;
    }
  }

  async prepareSfx(assetIds: readonly string[]): Promise<number> {
    const context = this.#requireGraph("SFX preparation");
    if (!context) return 0;
    const catalog = await this.#getCatalog();
    const results = await Promise.all(
      assetIds.map(async (id) => {
        try {
          const asset = catalog.getById(id);
          if (catalog.isLongForm(asset)) return false;
          await this.#decodeSfx(asset);
          return true;
        } catch (error) {
          this.#reportError(`SFX preparation failed (${id})`, error);
          return false;
        }
      }),
    );
    this.#notify();
    return results.filter(Boolean).length;
  }

  /** Development waveform analysis using this engine's existing AudioContext. */
  async analyzeSfx(assetIdOrRef: string, windowMs = 20): Promise<AudioAnalysis | null> {
    const context = this.#requireGraph("SFX analysis");
    if (!context) return null;
    try {
      const catalog = await this.#getCatalog();
      const asset = assetIdOrRef.startsWith("audio:")
        ? catalog.getBySemanticRef(assetIdOrRef)
        : catalog.getById(assetIdOrRef);
      const buffer = await this.#decodeSfx(asset);
      const windowSamples = Math.max(1, Math.round(buffer.sampleRate * windowMs / 1000));
      const windowCount = Math.ceil(buffer.length / windowSamples);
      const peakEnvelope = new Array<number>(windowCount).fill(0);
      const rmsEnvelope = new Array<number>(windowCount).fill(0);
      let globalPeak = 0;
      let globalRms = 0;
      for (let windowIndex = 0; windowIndex < windowCount; windowIndex += 1) {
        const start = windowIndex * windowSamples;
        const end = Math.min(buffer.length, start + windowSamples);
        let peak = 0;
        let sumSquares = 0;
        let sampleCount = 0;
        for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
          const channel = buffer.getChannelData(channelIndex);
          for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
            const value = channel[sampleIndex] ?? 0;
            peak = Math.max(peak, Math.abs(value));
            sumSquares += value * value;
            sampleCount += 1;
          }
        }
        const rms = Math.sqrt(sumSquares / Math.max(1, sampleCount));
        peakEnvelope[windowIndex] = peak;
        rmsEnvelope[windowIndex] = rms;
        globalPeak = Math.max(globalPeak, peak);
        globalRms = Math.max(globalRms, rms);
      }
      return {
        assetId: asset.id,
        duration: buffer.duration,
        windowMs,
        peakEnvelope: peakEnvelope.map((value) => value / Math.max(globalPeak, 0.000001)),
        rmsEnvelope: rmsEnvelope.map((value) => value / Math.max(globalRms, 0.000001)),
      };
    } catch (error) {
      this.#reportError(`SFX analysis failed (${assetIdOrRef})`, error);
      return null;
    }
  }

  clearDecodedSfxCache(): void {
    this.#decodedBuffers.clear();
    this.#notify();
  }

  stopAllSfx(): void {
    for (const handle of [...this.#sfx.values()]) handle.stop();
  }

  duckBus(bus: AudioBusName, options: DuckOptions = {}): DuckHandle | null {
    const context = this.#requireGraph("bus ducking");
    const graph = this.#buses?.[bus];
    if (!context || !graph || !this.#scopeAllows(options.scopeId)) return null;
    const id = createId("duck", ++this.#sequence);
    const attack = normalizedSeconds(options.attackSeconds, 0.15);
    const release = normalizedSeconds(options.releaseSeconds, 0.8);
    const hold = normalizedSeconds(options.holdSeconds, 1);
    const target = clamp(options.to ?? 0.3, 0.01, 1);
    this.#ducks.add({ id, bus, to: target });
    rampGain(graph.duck, this.#ducks.getTarget(bus), context, attack);
    let active = true;
    let unregisterScope: () => void = () => undefined;
    const handle: DuckHandle = {
      id,
      bus,
      isActive: () => active,
      release: (releaseSeconds = release) => {
        if (!active) return;
        active = false;
        unregisterScope();
        const timer = this.#duckTimers.get(id);
        if (timer !== undefined) window.clearTimeout(timer);
        this.#duckTimers.delete(id);
        this.#ducks.remove(id);
        rampGain(
          graph.duck,
          this.#ducks.getTarget(bus),
          context,
          normalizedSeconds(releaseSeconds, release),
        );
        this.#notify();
      },
    };
    unregisterScope = this.#registerScopeCleanup(options.scopeId, () =>
      handle.release(0.08),
    );
    if (hold > 0) {
      const timer = window.setTimeout(
        () => handle.release(release),
        (attack + hold) * 1000,
      );
      this.#duckTimers.set(id, timer);
    }
    this.#notify();
    return handle;
  }

  createLowRumble(options: LowRumbleOptions = {}): ProceduralHandle | null {
    const context = this.#requireGraph("low rumble");
    const bus = this.#buses?.procedural.level;
    if (!context || !bus || !this.#scopeAllows(options.scopeId)) return null;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = clamp(options.frequency ?? 46, 20, 100);
    filter.type = "lowpass";
    filter.frequency.value = 140;
    gain.gain.value = clampGain(options.gain ?? 0.055) * clampVolume(options.intensity ?? 0.6);
    lfo.frequency.value = 0.15;
    lfoGain.gain.value = gain.gain.value * 0.18;
    lfo.connect(lfoGain).connect(gain.gain);
    oscillator.connect(filter).connect(gain).connect(bus);
    oscillator.start();
    lfo.start();
    return this.#trackProcedural([oscillator, lfo], [filter, lfoGain], gain, options.scopeId);
  }

  createPulse(scopeId?: AudioScopeId): PulseHandle | null {
    const context = this.#requireGraph("heartbeat pulse");
    const bus = this.#buses?.procedural.level;
    if (!context || !bus || !this.#scopeAllows(scopeId)) return null;
    const parentGain = context.createGain();
    parentGain.gain.value = 1;
    parentGain.connect(bus);
    const childNodes = new Set<OscillatorNode>();
    const base = this.#trackProcedural([], [], parentGain, scopeId, () => {
      for (const node of childNodes) {
        try {
          node.stop();
        } catch {
          // The oscillator may already have ended.
        }
        node.disconnect();
      }
      childNodes.clear();
    });
    if (!base) return null;
    return {
      ...base,
      triggerPulse: () => {
        if (!base.isActive()) return;
        const now = context.currentTime;
        for (const [offset, frequency, level] of [
          [0, 64, 0.075],
          [0.13, 52, 0.045],
        ] as const) {
          const oscillator = context.createOscillator();
          const envelope = context.createGain();
          oscillator.type = "sine";
          oscillator.frequency.setValueAtTime(frequency, now + offset);
          envelope.gain.setValueAtTime(0.0001, now + offset);
          envelope.gain.exponentialRampToValueAtTime(level, now + offset + 0.015);
          envelope.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
          oscillator.connect(envelope).connect(parentGain);
          childNodes.add(oscillator);
          oscillator.addEventListener("ended", () => {
            childNodes.delete(oscillator);
            oscillator.disconnect();
            envelope.disconnect();
          });
          oscillator.start(now + offset);
          oscillator.stop(now + offset + 0.2);
        }
      },
    };
  }

  createFilteredNoise(
    options: FilteredNoiseOptions = {},
  ): ProceduralHandle | null {
    const context = this.#requireGraph("filtered noise");
    const bus = this.#buses?.procedural.level;
    if (!context || !bus || !this.#scopeAllows(options.scopeId)) return null;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = this.#getNoiseBuffer(context);
    source.loop = true;
    filter.type = "lowpass";
    filter.frequency.value = clamp(options.filterFrequency ?? 900, 80, 8000);
    filter.Q.value = clamp(options.q ?? 0.7, 0.0001, 20);
    gain.gain.value = clampGain(options.gain ?? 0.025);
    source.connect(filter).connect(gain).connect(bus);
    source.start();
    return this.#trackProcedural([source], [filter], gain, options.scopeId);
  }

  playUiTone(options: UiToneOptions = {}): ProceduralHandle | null {
    const context = this.#requireGraph("UI tone");
    const bus = this.#buses?.procedural.level;
    if (!context || !bus || !this.#scopeAllows(options.scopeId)) return null;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    const duration = clamp(options.durationSeconds ?? 0.16, 0.03, 2);
    oscillator.type = options.waveform ?? "sine";
    oscillator.frequency.value = clamp(options.frequency ?? 620, 40, 4000);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(clamp(options.gain ?? 0.06, 0.0001, 0.3), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(bus);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
    return this.#trackProcedural([oscillator], [], gain, options.scopeId, undefined, oscillator);
  }

  startRatingRise(options: RatingRiseOptions = {}): ProceduralHandle | null {
    const context = this.#requireGraph("rating rise");
    const bus = this.#buses?.procedural.level;
    if (!context || !bus || !this.#scopeAllows(options.scopeId)) return null;
    const oscillator = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const now = context.currentTime;
    const duration = clamp(options.durationSeconds ?? 2.2, 0.1, 15);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(
      clamp(options.startFrequency ?? 160, 30, 4000),
      now,
    );
    oscillator.frequency.exponentialRampToValueAtTime(
      clamp(options.endFrequency ?? 880, 31, 8000),
      now + duration,
    );
    filter.type = "lowpass";
    filter.frequency.value = 1800;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(clamp(options.gain ?? 0.045, 0.0001, 0.25), now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(filter).connect(gain).connect(bus);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
    return this.#trackProcedural([oscillator], [filter], gain, options.scopeId, undefined, oscillator);
  }

  createSoulHum(options: SoulHumOptions = {}): ProceduralHandle | null {
    const context = this.#requireGraph("soul hum");
    const bus = this.#buses?.procedural.level;
    if (!context || !bus || !this.#scopeAllows(options.scopeId)) return null;
    const fundamental = context.createOscillator();
    const harmonic = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    const baseFrequency = clamp(options.baseFrequency ?? 92, 40, 440);
    const baseGain = clamp(options.gain ?? 0.035, 0.001, 0.15) * clampVolume(options.intensity ?? 0.6);
    fundamental.type = "sine";
    fundamental.frequency.value = baseFrequency;
    harmonic.type = "sine";
    harmonic.frequency.value = baseFrequency * 1.5;
    filter.type = "lowpass";
    filter.frequency.value = 700;
    gain.gain.value = baseGain;
    lfo.frequency.value = 0.11;
    lfoGain.gain.value = baseGain * 0.28;
    fundamental.connect(filter);
    harmonic.connect(filter);
    filter.connect(gain).connect(bus);
    lfo.connect(lfoGain).connect(gain.gain);
    fundamental.start();
    harmonic.start();
    lfo.start();
    return this.#trackProcedural(
      [fundamental, harmonic, lfo],
      [filter, lfoGain],
      gain,
      options.scopeId,
    );
  }

  stopAllProcedural(): void {
    for (const handle of [...this.#procedural.values()]) handle.stop();
  }

  getCatalog(): Promise<AudioCatalog> {
    return this.#getCatalog();
  }

  #initializeGraph(context: AudioContext): void {
    this.#masterGain = context.createGain();
    this.#muteGain = context.createGain();
    this.#cinematicGain = context.createGain();
    this.#masterGain.gain.value = this.#levels.master;
    this.#muteGain.gain.value = this.#isMuted ? 0 : 1;
    this.#cinematicGain.gain.value = this.#cinematicSilence ? 0 : 1;
    this.#masterGain
      .connect(this.#muteGain)
      .connect(this.#cinematicGain)
      .connect(context.destination);

    this.#buses = Object.fromEntries(
      (["music", "ambient", "sfx", "procedural"] as const).map((name) => {
        const level = context.createGain();
        const duck = context.createGain();
        level.gain.value = this.#levels[name];
        duck.gain.value = 1;
        level.connect(duck).connect(this.#masterGain as GainNode);
        return [name, { level, duck }];
      }),
    ) as Record<AudioBusName, BusGraph>;

    const musicLevel = this.#buses.music.level;
    const musicDuck = this.#buses.music.duck;
    musicLevel.disconnect();
    this.#musicToneFilter = context.createBiquadFilter();
    this.#musicToneFilter.type = "lowpass";
    this.#musicToneFilter.frequency.value = this.#musicToneFrequency;
    this.#musicToneFilter.Q.value = 0.52;
    this.#musicPresenceGain = context.createGain();
    this.#musicPresenceGain.gain.value = this.#musicTonePresence;
    musicLevel
      .connect(this.#musicToneFilter)
      .connect(this.#musicPresenceGain)
      .connect(musicDuck);

    const musicBus = this.#buses.music.level;
    const createDeck = (name: "A" | "B"): MusicDeck => {
      const element = new Audio();
      element.loop = true;
      element.preload = "auto";
      const source = context.createMediaElementSource(element);
      const gain = context.createGain();
      gain.gain.value = 0;
      source.connect(gain).connect(musicBus);
      return {
        name,
        element,
        source,
        gain,
        targetGain: 0,
        state: null,
        asset: null,
        requestToken: 0,
      };
    };
    this.#musicDecks = [createDeck("A"), createDeck("B")];
  }

  #requireGraph(operation: string): AudioContext | null {
    if (this.#debugUnavailable) return null;
    if (!this.#context || this.#context.state !== "running" || !this.#buses) {
      this.#setError(`Audio must be unlocked before ${operation}.`);
      return null;
    }
    return this.#context;
  }

  #getContextState(): EngineContextState {
    if (this.#debugUnavailable) return "unavailable";
    if (!this.#context) {
      return this.#audioUnavailable ? "unavailable" : "locked";
    }
    return this.#context.state as EngineContextState;
  }

  #getCatalog(): Promise<AudioCatalog> {
    this.#catalogPromise ??= loadAudioCatalog();
    return this.#catalogPromise;
  }

  async #decodeSfx(asset: MediaAsset): Promise<AudioBuffer> {
    const context = this.#context;
    if (!context) throw new Error("AudioContext is unavailable for decoding.");

    return this.#decodedBuffers.load(asset.id, () =>
      fetch(asset.url, {
        cache: "force-cache",
        credentials: "same-origin",
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status} while fetching ${asset.id}`);
          }
          return response.arrayBuffer();
        })
        .then((bytes) => context.decodeAudioData(bytes))
        .finally(() => this.#notify()),
    );
  }

  #trackProcedural(
    sources: readonly (OscillatorNode | AudioBufferSourceNode)[],
    intermediates: readonly AudioNode[],
    gain: GainNode,
    scopeId?: AudioScopeId,
    extraCleanup?: () => void,
    endSource?: OscillatorNode | AudioBufferSourceNode,
  ): ProceduralHandle | null {
    if (!this.#context || !this.#scopeAllows(scopeId)) return null;
    const context = this.#context;
    const id = createId("procedural", ++this.#sequence);
    let active = true;
    let unregisterScope: () => void = () => undefined;
    const finalize = () => {
      if (!active) return;
      active = false;
      unregisterScope();
      extraCleanup?.();
      for (const source of sources) {
        try {
          source.stop();
        } catch {
          // Already stopped sources are safe to dispose.
        }
        source.disconnect();
      }
      for (const node of intermediates) node.disconnect();
      gain.disconnect();
      this.#procedural.delete(id);
      this.#notify();
    };
    const handle: ProceduralHandle = {
      id,
      kind: "procedural",
      isActive: () => active,
      stop: (options: StopOptions = {}) => {
        if (!active) return;
        const fade = normalizedSeconds(options.fadeSeconds, 0.08);
        rampGain(gain, 0, context, fade);
        if (fade === 0) finalize();
        else window.setTimeout(finalize, fade * 1000 + 20);
      },
      setGain: (value, rampSeconds = 0.03) =>
        rampGain(gain, clampGain(value), context, rampSeconds),
    };
    endSource?.addEventListener("ended", finalize, { once: true });
    this.#procedural.set(id, handle);
    unregisterScope = this.#registerScopeCleanup(scopeId, () =>
      handle.stop({ fadeSeconds: 0.06 }),
    );
    this.#notify();
    return handle;
  }

  #getNoiseBuffer(context: AudioContext): AudioBuffer {
    if (this.#noiseBuffer) return this.#noiseBuffer;
    const length = context.sampleRate * 2;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const channel = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.96 + white * 0.04;
      channel[index] = previous * 2.5;
    }
    this.#noiseBuffer = buffer;
    return buffer;
  }

  #scopeAllows(scopeId?: AudioScopeId): boolean {
    return !scopeId || this.#scopes.isActive(scopeId);
  }

  #registerScopeCleanup(
    scopeId: AudioScopeId | undefined,
    cleanup: () => void,
  ): () => void {
    return scopeId
      ? this.#scopes.register(scopeId, cleanup)
      : () => undefined;
  }

  #resetDeck(deck: MusicDeck): void {
    deck.element.pause();
    deck.element.removeAttribute("src");
    deck.element.load();
    deck.state = null;
    deck.asset = null;
    deck.requestToken = 0;
    deck.targetGain = 0;
    if (this.#context) rampGain(deck.gain, 0, this.#context, 0);
  }

  #clearMusicTimer(): void {
    if (this.#musicTimer !== null) window.clearTimeout(this.#musicTimer);
    this.#musicTimer = null;
  }

  #startMusicTicker(): void {
    this.#stopMusicTicker();
    this.#musicTicker = window.setInterval(() => this.#notify(), 500);
  }

  #stopMusicTicker(): void {
    if (this.#musicTicker !== null) window.clearInterval(this.#musicTicker);
    this.#musicTicker = null;
  }

  #setError(message: string): void {
    this.#lastError = message;
    this.#notify();
  }

  #persistMutePreference(): void {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(AUDIO_PREFERENCE_KEY, JSON.stringify({ version: 1, muted: this.#isMuted }));
    } catch {
      // Local preference persistence is best-effort.
    }
  }

  #reportError(label: string, error: unknown): string {
    const detail = error instanceof Error ? error.message : "Unknown audio error.";
    const message = `${label}: ${detail}`;
    this.#lastError = message;
    if (process.env.NODE_ENV === "development") console.error(message);
    this.#notify();
    return message;
  }

  #notify(): void {
    this.#revision += 1;
    this.#listeners.forEach((listener) => listener());
  }
}

let audioEngine: AudioEngine | undefined;

export function getAudioEngine(): AudioEngine {
  audioEngine ??= new AudioEngine();
  return audioEngine;
}
