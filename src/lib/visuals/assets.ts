import { assetUrl } from "@/lib/assets/paths";

export const VISUAL_ASSETS = Object.freeze({
  soul: Object.freeze({
    active: assetUrl("Global/GLOBAL-01.png"),
    dormant: assetUrl("Global/GLOBAL-01A.png"),
    charged: assetUrl("Global/GLOBAL-01B.png"),
    trail: assetUrl("Global/GLOBAL-02.png"),
  }),
  particles: assetUrl("Global/GLOBAL-03.png"),
  fog: Object.freeze({
    NEUTRAL: assetUrl("Global/GLOBAL-04A.mp4"),
    CRIMSON: assetUrl("Global/GLOBAL-04B.mp4"),
    HEAVY: assetUrl("Global/GLOBAL-04C.mp4"),
  }),
  displacement: assetUrl("Global/GLOBAL-06.png"),
  lightLeak: assetUrl("Global/GLOBAL-07.png"),
  transitions: Object.freeze({
    ORGANIC_DISSOLVE: assetUrl("Global/GLOBAL-09A.png"),
    SMOKE_REVEAL: assetUrl("Global/GLOBAL-09B.png"),
    SOUL_CIRCLE: assetUrl("Global/GLOBAL-09C.png"),
    VERTICAL_SLIT: assetUrl("Global/GLOBAL-09D.png"),
  }),
});

