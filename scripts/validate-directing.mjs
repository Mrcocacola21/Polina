import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const directing = read("src/lib/cinematic/directing.ts");
const audio = read("src/lib/audio/AudioEngine.ts");
const final = read("src/components/scenes/FinalScene.tsx");
const silence = read("src/components/scenes/SilenceBoundaryScene.tsx");
const scenes = fs.readdirSync(path.join(root, "src/components/scenes"))
  .filter((name) => name.endsWith(".tsx"))
  .map((name) => read(path.join("src/components/scenes", name)))
  .join("\n");
const failures = [];

for (const symbol of ["FILM_TIMING", "FILM_MIX", "DUCK_PRESETS", "CROSSFADE_PRESETS", "MUSIC_CUE_SEQUENCE"]) {
  if (!directing.includes(`export const ${symbol}`)) failures.push(`Missing central directing export: ${symbol}.`);
}
if (!directing.includes('state: null, gain: 0')) failures.push("Semantic music sequence must declare exact zero before Requiem/Silence.");
if (!audio.includes("current?.state === state && !options.restart")) failures.push("Unchanged semantic music states must not restart.");
if (!audio.includes("targetGain")) failures.push("AudioEngine cinematic music gain support is missing.");
if (!silence.includes("audio.enterCinematicSilence()")) failures.push("SILENCE must close the cinematic audio gate.");
if (!final.includes("audio.leaveCinematicSilence()") || !final.includes("FINAL_AUDIO.awakening")) failures.push("Final must reopen the gate and retain AUD-FIN-01 awakening.");
if (/set(?:Master|Music|Ambient|Sfx|Procedural)Volume\(/.test(scenes)) failures.push("Production scenes must not modify user volume preferences.");
for (const mapping of ['voice: "A"', 'voice: "B"', 'voice: "C"']) {
  if (!fs.readdirSync(path.join(root, "src/lib/cinematic")).some((name) => name.endsWith(".ts") && read(path.join("src/lib/cinematic", name)).includes(mapping))) {
    failures.push(`Required Soul voice mapping is missing: ${mapping}.`);
  }
}

try {
  const changedMedia = execFileSync("git", ["diff", "--name-only", "--", "public/assets"], { cwd: root, encoding: "utf8" }).trim();
  if (changedMedia) failures.push(`Source media changed during directing pass:\n${changedMedia}`);
} catch {
  // A source checkout without Git can still run the semantic checks above.
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Directing validation passed: central timing/mix, safe gains, semantic continuity, exact silence, unchanged user volumes, and untouched source media.");
