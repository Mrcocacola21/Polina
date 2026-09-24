import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "src", "lib", "cinematic", "requiem-cues.json");
const soulRegistryPath = path.join(root, "src", "lib", "souls", "soul-registry.json");
const required = [
  "public/assets/sfx/AUD-REQ-01.wav",
  "public/assets/sfx/AUD-REQ-02.wav",
  "public/assets/sfx/AUD-REQ-03.wav",
  "public/assets/sfx/AUD-REQ-04.wav",
  "public/assets/sfx/AUD-REQ-05.mp3",
  "public/assets/REQ/REQ-02.png",
  "public/assets/REQ/REQ-03.png",
  "public/assets/REQ/REQ-04.mp4",
];

const failures = [];
for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) failures.push(`Missing ${relative}`);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const heroPath = path.join(root, config.sourcePath);
const hash = crypto.createHash("sha256").update(fs.readFileSync(heroPath)).digest("hex").toUpperCase();
if (hash !== config.sha256) failures.push(`Cue hash is stale: ${hash} !== ${config.sha256}`);
if (!(config.duration > 0)) failures.push("Measured duration must be positive.");
if (!(config.analysisWindowMs >= 10 && config.analysisWindowMs <= 30)) failures.push("Analysis window must be 10-30 ms.");
const cueEntries = Object.entries(config.cues);
for (const [name, value] of cueEntries) {
  if (!(typeof value === "number" && value >= 0 && value <= config.duration)) {
    failures.push(`Invalid cue ${name}: ${value}`);
  }
}
const ordered = cueEntries.map(([, value]) => value);
if (ordered.some((value, index) => index > 0 && value <= ordered[index - 1])) {
  failures.push("Requiem cues must be strictly monotonic.");
}
if (!(config.cues.hardCut > config.cues.primaryImpact)) failures.push("hardCut must follow primaryImpact.");
if (!(config.cues.hardCut - config.cues.tailRelease >= 0.5 && config.cues.hardCut - config.cues.tailRelease <= 1)) {
  failures.push("hardCut must preserve 0.5-1.0 s after the final major transient.");
}
if (!Array.isArray(config.normalizedRmsEnvelope) || config.normalizedRmsEnvelope.length < 40 || config.normalizedRmsEnvelope.length > 500) {
  failures.push("Compact normalized envelope must contain 40-500 samples.");
}
const souls = JSON.parse(fs.readFileSync(soulRegistryPath, "utf8"));
if (souls.length !== 10 || new Set(souls.map((entry) => entry.soulId)).size !== 10) {
  failures.push("Exactly ten unique Requiem Soul identities are required.");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Requiem validation passed: ${hash}, ${config.duration.toFixed(3)}s, ${cueEntries.length} cues, ${souls.length} Souls.`);
