import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "..");
const assets = path.join(root, "public", "assets");
const registry = JSON.parse(await readFile(path.join(root, "src", "lib", "souls", "soul-registry.json"), "utf8"));
const visual = JSON.parse(await readFile(path.join(assets, "manifest.json"), "utf8"));
const audio = JSON.parse(await readFile(path.join(assets, "audio-manifest.json"), "utf8"));
const errors = [];

const expectedSouls = Array.from({ length: 10 }, (_, index) => `SOUL_${String(index + 1).padStart(2, "0")}`);
const expectedScenes = Array.from({ length: 10 }, (_, index) => `S${String(index + 1).padStart(2, "0")}`);
if (!Array.isArray(registry) || registry.length !== 10) errors.push("Registry must contain exactly 10 entries.");
if (new Set(registry.map((entry) => entry.soulId)).size !== 10) errors.push("Soul IDs must be unique.");
if (new Set(registry.map((entry) => entry.sceneId)).size !== 10) errors.push("Collectible scenes must be unique.");
if (new Set(registry.map((entry) => entry.slotIndex)).size !== 10) errors.push("Slot indices must be unique.");
if (expectedSouls.some((id) => !registry.some((entry) => entry.soulId === id))) errors.push("SOUL_01–SOUL_10 must all be present.");
if (expectedScenes.some((id) => !registry.some((entry) => entry.sceneId === id))) errors.push("S01–S10 must all be present.");
if (registry.some((entry) => entry.slotIndex < 1 || entry.slotIndex > 10)) errors.push("Slot indices must stay within 1–10.");

const requiredAssets = [
  visual.global.asset01,
  visual.global.asset01VariantA,
  visual.global.asset01VariantB,
  visual.global.asset02,
  visual.global.asset03,
  audio.global.soulSpawn,
  audio.global.soulFly,
  audio.global.soulVoiceA,
  audio.global.soulVoiceB,
  audio.global.soulVoiceC,
];
for (const asset of requiredAssets) {
  if (typeof asset !== "string") {
    errors.push("A required semantic Soul asset mapping is missing.");
    continue;
  }
  try {
    const target = await stat(path.join(assets, ...asset.split("/")));
    if (!target.isFile()) errors.push(`${asset} is not a file.`);
  } catch {
    errors.push(`Missing required Soul asset: ${asset}`);
  }
}

if (errors.length) {
  for (const error of errors) console.error(`soul validation error: ${error}`);
  process.exitCode = 1;
} else {
  console.log("soul collection validation passed: 10 slots, 10 scene mappings, 10 required assets");
}
