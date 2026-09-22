"use client";

import {
  useMediaDiagnostics,
  useMediaPreloadActions,
} from "@/lib/media/MediaPreloadContext";
import {
  PRELOAD_GROUP_IDS,
  type PreloadGroupId,
} from "@/lib/media/preload-plan";

import styles from "./MediaDebugPanel.module.css";

const MANUAL_GROUPS: readonly PreloadGroupId[] = [
  "DURING_S03",
  "DURING_S07",
];

export function MediaDebugPanel() {
  const diagnostics = useMediaDiagnostics();
  const { preloadGroup, retryFailed, startAfterOpenSoul } =
    useMediaPreloadActions();

  return (
    <aside className={styles.panel} data-testid="media-debug-panel">
      <strong>MEDIA PRELOADER</strong>
      <div className={styles.groups}>
        {PRELOAD_GROUP_IDS.map((groupId) => {
          const progress = diagnostics.groups[groupId];
          return (
            <div key={groupId} data-testid={`media-group-${groupId}`}>
              <span>{groupId}</span>
              <span>{progress.state}</span>
              <span>
                {progress.ready}/{progress.total} ready · {progress.failed} failed
              </span>
            </div>
          );
        })}
      </div>

      <dl className={styles.metrics}>
        <div>
          <dt>queue</dt>
          <dd>{diagnostics.queue.queued}</dd>
        </div>
        <div>
          <dt>active</dt>
          <dd>{diagnostics.queue.active}</dd>
        </div>
        <div>
          <dt>cached</dt>
          <dd>{diagnostics.cachedAssets}</dd>
        </div>
      </dl>

      {diagnostics.failures.length > 0 ? (
        <ul className={styles.failures}>
          {diagnostics.failures.slice(0, 5).map((failure) => (
            <li key={failure.asset.id}>{failure.asset.id}</li>
          ))}
        </ul>
      ) : null}

      <div className={styles.controls}>
        <button type="button" onClick={() => void startAfterOpenSoul()}>
          Trigger Open Soul
        </button>
        {MANUAL_GROUPS.map((groupId) => (
          <button
            key={groupId}
            type="button"
            onClick={() => void preloadGroup(groupId)}
          >
            Trigger {groupId}
          </button>
        ))}
        <button
          type="button"
          disabled={diagnostics.failures.length === 0}
          onClick={() => void retryFailed()}
        >
          Retry failed media
        </button>
      </div>
    </aside>
  );
}
