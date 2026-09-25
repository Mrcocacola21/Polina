import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const failures = [];

const sceneStyles = [
  "PreloaderScene", "PrologueScene", "Soul01Scene", "Soul02Scene", "Soul03Scene", "Soul04Scene",
  "Soul05Scene", "Soul06Scene", "Soul07Scene", "Soul08Scene", "Soul09Scene", "Soul10Scene",
  "PreFinalScene", "SoulsReleaseScene", "RequiemScene", "SilenceBoundaryScene", "FinalScene",
];
for (const name of sceneStyles) {
  const relativePath = `src/components/scenes/${name}.module.css`;
  if (!fs.existsSync(path.join(root, relativePath))) failures.push(`Missing production scene style module: ${relativePath}`);
}

const globals = read("src/app/globals.css");
for (const token of [
  "--grade-black", "--grade-charcoal", "--grade-crimson", "--font-display", "--font-narrative",
  "--font-interface", "--font-system", "--desktop-edge-safe", "--desktop-text-safe", "--desktop-hud-safe",
  "--narrative-measure", "--control-hit-size",
]) {
  if (!globals.includes(`${token}:`)) failures.push(`Missing desktop visual token: ${token}`);
}

const desktop = read("src/lib/visuals/desktop.ts");
for (const required of ["1920, height: 1080", "2560, height: 1440", 'coordinateSpace: "CSS_PIXELS"', 'intendedQuality: "HIGH"']) {
  if (!desktop.includes(required)) failures.push(`Desktop lock constant missing: ${required}`);
}

const criticalStyles = [
  "src/components/scenes/Soul03Scene.module.css",
  "src/components/scenes/Soul07Scene.module.css",
  "src/components/scenes/Soul08Scene.module.css",
  "src/components/scenes/Soul09Scene.module.css",
  "src/components/scenes/RequiemScene.module.css",
  "src/components/scenes/FinalScene.module.css",
].map(read).join("\n");
if (/(?:min-)?(?:width|height)\s*:\s*(?:1920|2560|1080|1440)px/i.test(criticalStyles)) {
  failures.push("Critical scene styles contain a fixed reference-viewport dimension instead of responsive composition sizing.");
}

const scenes = read("src/lib/cinematic/scenes.ts");
const canonical = ["PRELOADER", "PROLOGUE", "S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10", "PRE_FINAL", "SOULS_RELEASE", "REQUIEM", "SILENCE", "FINAL"];
for (const id of canonical) {
  if (!scenes.includes(`"${id}"`)) failures.push(`Canonical production scene ID missing: ${id}`);
}

const narrative = [6, 7, 8, 9, 10, 11, 13].map((phase) => read(`src/lib/cinematic/phase${phase}.ts`)).join("\n");
for (const exact of [
  "Просто существуя рядом в дискордике с тобой, я снова почувствовал себя спокойным",
  "Королеву не убить, Я умру за королеву",
  "Можна я буду с тобой сердцем и душой?",
  "го встр типа",
]) {
  if (!narrative.includes(exact)) failures.push(`Mandatory narrative text changed or missing: ${exact}`);
}

const manifest = JSON.parse(read("public/assets/manifest.json"));
for (const asset of [manifest.finale.asset01VariantC, manifest.finale.asset01VariantA, manifest.finale.asset01VariantB, manifest.finale.asset01, manifest.finale.asset02]) {
  if (!asset || !fs.existsSync(path.join(root, "public", "assets", asset))) failures.push(`Missing FINAL visual asset: ${asset ?? "undefined"}`);
}

try {
  const changedAssets = execFileSync("git", ["diff", "--name-only", "--", "public/assets"], { cwd: root, encoding: "utf8" }).trim();
  if (changedAssets) failures.push(`Source assets were modified:\n${changedAssets}`);
} catch {
  // Semantic checks remain useful in source archives without Git metadata.
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Desktop validation passed: production modules, lock constants, visual tokens, responsive critical styles, canonical scenes/text, FINAL media, and untouched source assets.");

