import type { SceneId } from "../cinematic/scenes";
import type { AudioScopeId } from "./types";

export type ScopeCleanup = () => void;

export function createSceneAudioScopeId(
  sceneId: SceneId,
  runId: number,
): AudioScopeId {
  return `${sceneId}#run-${runId}`;
}

export class AudioScopeRegistry {
  readonly #scopes = new Map<AudioScopeId, Set<ScopeCleanup>>();

  activate(scopeId: AudioScopeId): void {
    if (!this.#scopes.has(scopeId)) this.#scopes.set(scopeId, new Set());
  }

  isActive(scopeId: AudioScopeId): boolean {
    return this.#scopes.has(scopeId);
  }

  register(scopeId: AudioScopeId, cleanup: ScopeCleanup): () => void {
    const entries = this.#scopes.get(scopeId);
    if (!entries) {
      cleanup();
      return () => undefined;
    }

    entries.add(cleanup);
    return () => entries.delete(cleanup);
  }

  cleanup(scopeId: AudioScopeId): void {
    const entries = this.#scopes.get(scopeId);
    if (!entries) return;
    this.#scopes.delete(scopeId);

    for (const cleanup of entries) {
      try {
        cleanup();
      } catch {
        // Scope cleanup is best-effort and must remain idempotent.
      }
    }
    entries.clear();
  }

  get size(): number {
    return this.#scopes.size;
  }
}
