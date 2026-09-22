export type AssetPath = string;

export type AssetGroup = {
  readonly [key: string]: AssetPath | AssetGroup;
};

export interface VisualManifest {
  readonly brand: AssetGroup;
  readonly finale: AssetGroup;
  readonly global: AssetGroup;
  readonly requirements: AssetGroup;
  readonly sections: AssetGroup;
  readonly screens: AssetGroup;
}

export interface AudioManifest {
  readonly global: AssetGroup;
  readonly prologue: AssetGroup;
  readonly scenes: AssetGroup;
  readonly requiem: AssetGroup;
  readonly final: AssetGroup;
  readonly yesEnding: AssetGroup;
  readonly music: AssetGroup;
}
