import { readFile } from "node:fs/promises";
import process from "node:process";

const read = (file) => readFile(file, "utf8");
const [capabilities, motion, director, prologue, s02, s05, s06, s09, final, webgl, visualCss, globalCss] = await Promise.all([
  read("src/lib/accessibility/capabilities.ts"),
  read("src/components/visuals/MotionPreference.tsx"),
  read("src/components/cinematic/SceneDirector.tsx"),
  read("src/components/scenes/PrologueScene.tsx"),
  read("src/components/scenes/Soul02Scene.tsx"),
  read("src/components/scenes/Soul05Scene.tsx"),
  read("src/components/scenes/Soul06Scene.tsx"),
  read("src/components/scenes/Soul09Scene.tsx"),
  read("src/components/scenes/FinalScene.tsx"),
  read("src/components/visuals/GlobalWebGLCanvas.tsx"),
  read("src/components/visuals/visuals.module.css"),
  read("src/app/globals.css"),
]);

const checks = [
  [capabilities.includes('MotionMode = "FULL" | "REDUCED"') && capabilities.includes("prefers-reduced-motion"), "central semantic motion mode"],
  [motion.includes("useCapabilities") && !motion.includes("matchMedia"), "live motion preference uses central capability state"],
  [director.includes("<MuteControl"), "global mute control is mounted"],
  [[prologue, s02, s05, s06, s09, final].every((source) => source.includes("<button")), "required interactions use semantic buttons"],
  [s09.includes("event.repeat") && s09.includes("onPointerCancel") && s09.includes("onBlur={endHold}"), "S09 keyboard hold safety"],
  [final.includes('id="final-question"') && final.includes('aria-labelledby="final-question"') && final.includes("<fieldset"), "final question and answer group association"],
  [final.includes("FINAL_QUESTION") && final.includes("ANSWER_LABELS.YES") && final.includes("ANSWER_LABELS.THINK"), "mandatory final text remains semantic"],
  [webgl.includes('aria-hidden="true"'), "decorative WebGL and DOM fallback hidden from accessibility tree"],
  [/\.webglLayer \*,\s*\.soulForegroundLayer \*\s*\{[^}]*pointer-events:\s*none\s*!important/s.test(visualCss), "decorative WebGL descendants cannot intercept controls"],
  [globalCss.includes(":focus-visible") && globalCss.includes("forced-colors"), "visible focus and forced-colors baseline"],
  [!globalCss.includes("user-scalable=no") && !globalCss.includes("maximum-scale=1"), "browser zoom remains enabled"],
];

for (const [ok, label] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (checks.some(([ok]) => !ok)) process.exitCode = 1;
