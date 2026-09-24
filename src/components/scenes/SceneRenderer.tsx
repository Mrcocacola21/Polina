"use client";

import type { ComponentType } from "react";

import { PlaceholderScene } from "@/components/cinematic/PlaceholderScene";
import type { SceneDefinition, SceneId } from "@/lib/cinematic/scenes";

import { PreloaderScene } from "./PreloaderScene";
import { PreFinalScene } from "./PreFinalScene";
import { PrologueScene } from "./PrologueScene";
import { Soul01Scene } from "./Soul01Scene";
import { Soul02Scene } from "./Soul02Scene";
import { Soul03Scene } from "./Soul03Scene";
import { Soul04Scene } from "./Soul04Scene";
import { Soul05Scene } from "./Soul05Scene";
import { Soul06Scene } from "./Soul06Scene";
import { Soul07Scene } from "./Soul07Scene";
import { Soul08Scene } from "./Soul08Scene";
import { Soul09Scene } from "./Soul09Scene";
import { Soul10Scene } from "./Soul10Scene";
import { SoulsReleaseScene } from "./SoulsReleaseScene";
import { RequiemScene } from "./RequiemScene";
import { SilenceBoundaryScene } from "./SilenceBoundaryScene";
import { FinalScene } from "./FinalScene";

type ProductionSceneComponent = ComponentType;

export const PRODUCTION_SCENE_COMPONENTS: Readonly<
  Partial<Record<SceneId, ProductionSceneComponent>>
> = Object.freeze({
  PRELOADER: PreloaderScene,
  PROLOGUE: PrologueScene,
  S01: Soul01Scene,
  S02: Soul02Scene,
  S03: Soul03Scene,
  S04: Soul04Scene,
  S05: Soul05Scene,
  S06: Soul06Scene,
  S07: Soul07Scene,
  S08: Soul08Scene,
  S09: Soul09Scene,
  S10: Soul10Scene,
  PRE_FINAL: PreFinalScene,
  SOULS_RELEASE: SoulsReleaseScene,
  REQUIEM: RequiemScene,
  SILENCE: SilenceBoundaryScene,
  FINAL: FinalScene,
});

export function SceneRenderer({ scene }: Readonly<{ scene: SceneDefinition }>) {
  const ProductionScene = PRODUCTION_SCENE_COMPONENTS[scene.id];
  return ProductionScene ? <ProductionScene /> : <PlaceholderScene scene={scene} />;
}
