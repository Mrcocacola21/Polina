export class VisualScope {
  readonly id: string;
  #cleanups = new Set<() => void>();
  #disposed = false;

  constructor(id: string) {
    this.id = id;
  }

  add(cleanup: () => void): () => void {
    if (this.#disposed) {
      cleanup();
      return () => undefined;
    }
    this.#cleanups.add(cleanup);
    return () => {
      if (!this.#cleanups.delete(cleanup)) return;
      cleanup();
    };
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const cleanup of [...this.#cleanups].reverse()) cleanup();
    this.#cleanups.clear();
  }
}

export function createSceneVisualScopeId(sceneId: string, runId: number): string {
  return `scene:${sceneId}:${runId}`;
}
