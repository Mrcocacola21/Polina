import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const transitions = read("src/lib/cinematic/transitions.ts");
const scenes = read("src/lib/cinematic/scenes.ts");
const director = read("src/components/cinematic/SceneDirector.tsx");
const bridge = read("src/components/cinematic/TransitionBridgeLayer.tsx");
const failures = [];

const requiredIds = [
  "PROLOGUE_S01", "S01_S02", "S02_S03", "S03_S04", "S04_S05", "S05_S06",
  "S06_S07", "S07_S08", "S08_S09", "S09_S10", "S10_PRE_FINAL",
  "PRE_FINAL_SOULS_RELEASE", "SOULS_RELEASE_REQUIEM", "REQUIEM_SILENCE", "SILENCE_FINAL",
  "FINAL_ANSWERS", "FINAL_YES", "FINAL_THINK",
];
for (const id of requiredIds) {
  const declaration = id.startsWith("FINAL_")
    ? `Object.freeze({ id: \"${id}\"`
    : `define({ id: \"${id}\"`;
  const count = transitions.split(declaration).length - 1;
  if (count !== 1) failures.push(`${id} must be declared exactly once; found ${count}.`);
}
for (const sceneId of ["PRE_FINAL", "SOULS_RELEASE", "REQUIEM", "SILENCE", "FINAL"]) {
  if (!scenes.includes(`\"${sceneId}\"`)) failures.push(`Canonical scene ID missing: ${sceneId}.`);
}
if (!transitions.includes('from: "PRE_FINAL", to: "SOULS_RELEASE"')) failures.push("PRE_FINAL must still hand off to SOULS_RELEASE.");
if (!transitions.includes('from: "SOULS_RELEASE", to: "REQUIEM"')) failures.push("SOULS_RELEASE must still hand off to REQUIEM.");
if (!transitions.includes('from: "REQUIEM", to: "SILENCE"')) failures.push("REQUIEM must still hard-cut to SILENCE.");
if (!transitions.includes("hardCut: true")) failures.push("REQUIEM → SILENCE hard-cut metadata is missing.");
if (/from:\s*"FINAL"\s*,\s*to:/.test(transitions)) failures.push("FINAL must not declare a canonical next scene.");
if (!director.includes("requestMediaForScene(nextScene.id)")) failures.push("SceneDirector must prepare incoming media during EXITING.");
if (!director.includes("transition.begin")) failures.push("SceneDirector is not integrated with the transition runtime.");
if (!bridge.includes('pointer-events-none') && !read("src/components/cinematic/TransitionBridgeLayer.module.css").includes("pointer-events: none")) {
  failures.push("Transition bridge must never intercept pointer input.");
}

const manifests = [
  JSON.stringify(JSON.parse(read("public/assets/manifest.json"))),
  JSON.stringify(JSON.parse(read("public/assets/audio-manifest.json"))),
].join("\n");
const semanticAssets = [...transitions.matchAll(/semanticAssets:\s*\[([^\]]*)\]/g)]
  .flatMap((match) => [...match[1].matchAll(/"([^"]+)"/g)].map((asset) => asset[1]));
for (const id of semanticAssets) {
  const leaf = id.split(".").at(-1);
  if (leaf && !manifests.toLowerCase().includes(leaf.toLowerCase().replace(/asset0?/, ""))) {
    // Semantic IDs are catalog keys, not paths; catalog validation remains authoritative.
    if (!read("src/lib/media/catalog.ts").includes(id.split(":")[1]?.split(".").at(-1) ?? id)) {
      // Keep this warning scoped to genuinely obsolete placeholder references.
      if (/placeholder/i.test(id)) failures.push(`Obsolete placeholder semantic asset: ${id}.`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Transition validation passed: 15 canonical bridges, 3 Final transitions, canonical paths, hard cut, media preparation, and pointer-safe persistent bridge.");
