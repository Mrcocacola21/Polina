import type { ReactNode } from "react";

import styles from "./FullscreenStage.module.css";

type FullscreenStageProps = Readonly<{
  children?: ReactNode;
}>;

export function FullscreenStage({ children }: FullscreenStageProps) {
  return <main className={styles.stage} data-cinematic-stage>{children}</main>;
}
