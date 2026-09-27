import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFile(path.join(root, relative), "utf8");
const [config, runtime, target, types, waitingVisual, canvas, ...scenes] = await Promise.all([
  read("src/lib/souls/claim-config.ts"),
  read("src/lib/souls/SoulCollectionRuntime.ts"),
  read("src/components/souls/SoulClaimTarget.tsx"),
  read("src/lib/souls/types.ts"),
  read("src/lib/souls/waiting-visual.ts"),
  read("src/components/visuals/GlobalWebGLCanvas.tsx"),
  ...Array.from({ length: 10 }, (_, index) => read(`src/components/scenes/Soul${String(index + 1).padStart(2, "0")}Scene.tsx`)),
]);
const errors = [];
const expectedVoices = ["A", "NONE", "B", "NONE", "NONE", "C", "NONE", "A", "NONE", "NONE"];
expectedVoices.forEach((voice, index) => {
  const id = `SOUL_${String(index + 1).padStart(2, "0")}`;
  if (!new RegExp(`${id}: define\\(\\"${voice}\\"`).test(config)) errors.push(`${id} has no explicit ${voice} claim mapping.`);
});
if (!config.includes('SOUL_WAITING_AUDIO = "audio:global.soulSpawn"')) errors.push("AUD-GLOBAL-01 is not the waiting audio.");
if (!config.includes('SOUL_CLAIM_AUDIO = "audio:global.soulFly"')) errors.push("AUD-GLOBAL-03 is not the claim audio.");
if (!runtime.includes('claimState.stage !== "WAITING"')) errors.push("Runtime does not guard claim by WAITING state.");
if (!runtime.includes('loop: false')) errors.push("AUD-GLOBAL-01 loop policy is not explicit.");
if (!runtime.includes('advanceSoulClaim(transaction.claimState, "ABSORBING")')) errors.push("HUD absorption stage is missing.");
if (!target.includes('runtime.claimActiveSoul("POINTER")')) errors.push("Desktop hover claim is missing.");
if (!target.includes('runtime.claimActiveSoul("TOUCH")')) errors.push("Touch claim is missing.");
if (!target.includes('runtime.claimActiveSoul("KEYBOARD")')) errors.push("Keyboard claim is missing.");
if (!types.includes('"WAITING"')) errors.push("WAITING semantic state is missing.");
if (!runtime.includes("resolveWaitingSoulPosition")) errors.push("WAITING claim position is not screen-safe.");
if (!runtime.includes("setScreenPosition")) errors.push("WAITING hit target cannot follow responsive repositioning.");
if (!waitingVisual.includes("minimumOpacity")) errors.push("WAITING visual opacity floor is missing.");
if (!waitingVisual.includes("minimumScreenSize")) errors.push("WAITING minimum screen size is missing.");
if (!waitingVisual.includes("validateWaitingSoulVisual")) errors.push("WAITING visibility validator is missing.");
if (!canvas.includes("soulForegroundLayer")) errors.push("Souls are not isolated onto the foreground WebGL layer.");
if (scenes.some((scene) => /autoCollect\s*[:=]\s*true/.test(scene))) errors.push("A production scene enables autoCollect.");
if (scenes.some((scene) => /voice:\s*S\d+_COLLECTION/.test(scene))) errors.push("A production scene duplicates the voice mapping.");
if (/Math\.random\s*\(/.test(config + runtime)) errors.push("Soul claim configuration uses randomness.");

if (errors.length) {
  errors.forEach((error) => console.error(`soul claim validation error: ${error}`));
  process.exitCode = 1;
} else {
  console.log("soul claim validation passed: ten explicit claims, deterministic voices, hover/touch/keyboard fallbacks");
}
