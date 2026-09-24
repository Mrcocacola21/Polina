export const ANSWER_LABELS = Object.freeze({
  YES: "Да ❤️",
  THINK: "Подумать, но нежно",
} as const);

export type AnswerResult = keyof typeof ANSWER_LABELS;

export type AnswerState =
  | "UNANSWERED"
  | "COMMITTING_YES"
  | "COMMITTING_THINK"
  | "YES"
  | "THINK";

export type PersistedAnswer = Readonly<{
  version: 1;
  result: AnswerResult;
  answeredAt: string;
  finalDateDisplay?: string;
}>;

export type AnswerSnapshot = Readonly<{
  state: AnswerState;
  locked: boolean;
  result: AnswerResult | null;
  answeredAt: string | null;
  finalDateDisplay: string | null;
  transaction: number;
}>;

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const ANSWER_PERSISTENCE_KEY = "soulbound.answer.v1";

export const ANSWER_TIMING = Object.freeze({
  revealDelayAfterFinalStable: 2.5,
});

export const YES_TIMING = Object.freeze({
  stillness: 0.3,
  heartPulse: 0.3,
  soulEchoes: 0.7,
  release: 1.2,
  musicOpenDuration: 2.3,
  releaseSettle: 4.5,
  resolve: 4.55,
  dateReveal: 6.35,
  stable: 11.9,
});

export const THINK_TIMING = Object.freeze({
  stillness: 0.28,
  controlsGone: 0.82,
  calm: 1.45,
  stable: 2.4,
});

export const YES_VISUAL_LEVELS = Object.freeze({
  soulEchoCount: 10,
  releaseParticleCount: 760,
  releaseLifetime: 5.25,
  lowMusicPresence: 0.64,
  lowMusicFrequency: 9_500,
  yesHeartScale: 1.035,
  yesCameraScale: 0.978,
});

export const YES_AUDIO = Object.freeze({
  soulRelease: "audio:yesEnding.soulRelease",
  finalResolve: "audio:yesEnding.finalResolve",
});

export const YES_AUDIO_DURATIONS = Object.freeze({
  soulRelease: 4.4,
  finalResolve: 7.2,
});

const DATE_DISPLAY_PATTERN = /^\d{2}\.\d{2}\.\d{4}$/;

export function formatAnswerDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

export function isAnswerResult(value: unknown): value is AnswerResult {
  return value === "YES" || value === "THINK";
}

export function parsePersistedAnswer(value: string | null): PersistedAnswer | null {
  if (!value) return null;
  try {
    const candidate: unknown = JSON.parse(value);
    if (!candidate || typeof candidate !== "object") return null;
    const record = candidate as Record<string, unknown>;
    if (record.version !== 1 || !isAnswerResult(record.result)) return null;
    if (typeof record.answeredAt !== "string" || !Number.isFinite(Date.parse(record.answeredAt))) {
      return null;
    }
    if (
      record.finalDateDisplay !== undefined &&
      (typeof record.finalDateDisplay !== "string" || !DATE_DISPLAY_PATTERN.test(record.finalDateDisplay))
    ) {
      return null;
    }
    return {
      version: 1,
      result: record.result,
      answeredAt: record.answeredAt,
      ...(record.finalDateDisplay ? { finalDateDisplay: record.finalDateDisplay } : {}),
    };
  } catch {
    return null;
  }
}

export function readPersistedAnswer(storage: StorageLike): PersistedAnswer | null {
  try {
    return parsePersistedAnswer(storage.getItem(ANSWER_PERSISTENCE_KEY));
  } catch {
    return null;
  }
}

export function persistAnswer(storage: StorageLike, record: PersistedAnswer): boolean {
  try {
    storage.setItem(ANSWER_PERSISTENCE_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

export function clearPersistedAnswer(storage: StorageLike): boolean {
  try {
    storage.removeItem(ANSWER_PERSISTENCE_KEY);
    return true;
  } catch {
    return false;
  }
}

function unansweredSnapshot(transaction: number): AnswerSnapshot {
  return {
    state: "UNANSWERED",
    locked: false,
    result: null,
    answeredAt: null,
    finalDateDisplay: null,
    transaction,
  };
}

export class AnswerController {
  #snapshot: AnswerSnapshot = unansweredSnapshot(0);

  getSnapshot(): AnswerSnapshot {
    return this.#snapshot;
  }

  commit(result: AnswerResult, date = new Date()): Readonly<{
    accepted: boolean;
    snapshot: AnswerSnapshot;
    record: PersistedAnswer | null;
  }> {
    if (this.#snapshot.state !== "UNANSWERED") {
      return { accepted: false, snapshot: this.#snapshot, record: null };
    }
    const answeredAt = date.toISOString();
    const finalDateDisplay = formatAnswerDate(date);
    const transaction = this.#snapshot.transaction + 1;
    this.#snapshot = {
      state: result === "YES" ? "COMMITTING_YES" : "COMMITTING_THINK",
      locked: true,
      result,
      answeredAt,
      finalDateDisplay,
      transaction,
    };
    return {
      accepted: true,
      snapshot: this.#snapshot,
      record: {
        version: 1,
        result,
        answeredAt,
        ...(result === "YES" ? { finalDateDisplay } : {}),
      },
    };
  }

  stabilize(transaction: number): AnswerSnapshot {
    if (transaction !== this.#snapshot.transaction || !this.#snapshot.result) {
      return this.#snapshot;
    }
    const expected = `COMMITTING_${this.#snapshot.result}` as AnswerState;
    if (this.#snapshot.state !== expected) return this.#snapshot;
    this.#snapshot = {
      ...this.#snapshot,
      state: this.#snapshot.result,
      locked: true,
    };
    return this.#snapshot;
  }

  hydrate(record: PersistedAnswer): AnswerSnapshot {
    const date = new Date(record.answeredAt);
    this.#snapshot = {
      state: record.result,
      locked: true,
      result: record.result,
      answeredAt: record.answeredAt,
      finalDateDisplay: record.finalDateDisplay ?? formatAnswerDate(date),
      transaction: this.#snapshot.transaction + 1,
    };
    return this.#snapshot;
  }

  reset(): AnswerSnapshot {
    this.#snapshot = unansweredSnapshot(this.#snapshot.transaction + 1);
    return this.#snapshot;
  }
}
