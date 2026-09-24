import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const phase14 = read("src/lib/cinematic/phase14.ts");
const finalScene = read("src/components/scenes/FinalScene.tsx");
const scenes = read("src/lib/cinematic/scenes.ts");
const audioManifest = JSON.parse(read("public/assets/audio-manifest.json"));
const failures = [];

for (const label of ["Да ❤️", "Подумать, но нежно"]) {
  if (!phase14.includes(label)) failures.push(`Missing exact answer label: ${label}`);
}
for (const relativePath of [audioManifest.yesEnding.soulRelease, audioManifest.yesEnding.finalResolve, audioManifest.music.heartAndSoul]) {
  if (!fs.existsSync(path.join(root, "public", "assets", relativePath))) failures.push(`Missing ending audio: ${relativePath}`);
}
if (!phase14.includes('ANSWER_PERSISTENCE_KEY = "soulbound.answer.v1"')) failures.push("Central answer persistence key is missing.");
if (!/export type AnswerResult = keyof typeof ANSWER_LABELS/.test(phase14)) failures.push("AnswerResult is not constrained to YES / THINK.");
if (!/"FINAL",\s*\]\s*as const/.test(scenes)) failures.push("FINAL is not the canonical terminal scene.");
if (/YES_SCENE|THINK_SCENE/.test(scenes)) failures.push("YES/THINK must not be SceneIds.");
if (/fetch\(|sendBeacon|\/api\/|createServerAction/.test(finalScene)) failures.push("Remote answer persistence is prohibited.");
if (/onMouseMove|translateX\([^)]*pointer|Math\.random\(\).*button/.test(finalScene)) failures.push("Possible runaway-button behavior detected.");
if (/collectSoul\s*\(/.test(finalScene)) failures.push("Answer endings must not mutate SoulCollectionRuntime.");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Ending validation passed: exact choices, local versioned persistence, YES audio, and terminal FINAL semantics.");
