import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const visualManifest = JSON.parse(read("public/assets/manifest.json"));
const audioManifest = JSON.parse(read("public/assets/audio-manifest.json"));
const audioMap = JSON.parse(read("src/lib/audio/audio-map.json"));
const phase13 = read("src/lib/cinematic/phase13.ts");
const finalScene = read("src/components/scenes/FinalScene.tsx");
const resolver = read("src/components/scenes/SceneRenderer.tsx");
const failures = [];

const expected = [
  visualManifest.finale.asset01VariantC,
  visualManifest.finale.asset01VariantA,
  visualManifest.finale.asset01VariantB,
  visualManifest.finale.asset01,
  visualManifest.finale.asset02,
  audioManifest.final.soulHeartAwakening,
  audioManifest.final.twoSoulsMerge,
  audioManifest.final.haloBloom,
  audioManifest.music.heartAndSoul,
];
for (const relativePath of expected) {
  if (!fs.existsSync(path.join(root, "public", "assets", relativePath))) {
    failures.push(`Missing final media: ${relativePath}`);
  }
}

for (const exact of [
  "если убрать доту",
  "если убрать рофлы",
  "если убрать этот сайт",
  "останется одна вещь",
  "Можна я буду с тобой сердцем и душой?",
  "го встр типа",
]) {
  if (!phase13.includes(exact)) failures.push(`Missing exact Phase 13 copy: ${exact}`);
}

if (audioMap.music.HEART_AND_SOUL !== "audio:music.heartAndSoul") {
  failures.push("HEART_AND_SOUL does not resolve to MUS-04.");
}
if (!resolver.includes("FINAL: FinalScene")) failures.push("FINAL production resolver is missing.");
if (/collectSoul\s*\(|requestAdvance|setContinueVisible/.test(finalScene)) {
  failures.push("Final must remain terminal and must not mutate Soul collection state.");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Final validation passed: five FIN layers, three Final cues, MUS-04, exact copy, and terminal semantics.");
