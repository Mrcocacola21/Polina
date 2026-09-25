import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repositoryRoot = process.cwd();
const manifestFiles = [
  ["visual", path.join(repositoryRoot, "public", "assets", "manifest.json")],
  ["audio", path.join(repositoryRoot, "public", "assets", "audio-manifest.json")],
];
const planFile = path.join(
  repositoryRoot,
  "src",
  "lib",
  "media",
  "preload-plan.json",
);
const requiredGroups = [
  "BOOT_CRITICAL",
  "AFTER_OPEN_SOUL",
  "DURING_S03",
  "DURING_S07",
  "BEFORE_REQUIEM",
  "BEFORE_FINAL",
];
const supportedExtensions = new Set([".png", ".jpg", ".jpeg", ".mp4", ".wav", ".mp3"]);
const intentionallyUnassignedPaths = new Set([
  "sfx/AUD-GLOBAL-04.wav",
  "Global/GLOBAL-09A.png",
  "Global/GLOBAL-09B.png",
]);

function collectManifestEntries(value, prefix, entries) {
  if (typeof value === "string") {
    entries.set(prefix, value.replaceAll("\\", "/"));
    return;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid manifest value at ${prefix}.`);
  }

  for (const [key, child] of Object.entries(value)) {
    const separator = prefix.includes(":") ? "." : ":";
    collectManifestEntries(child, `${prefix}${separator}${key}`, entries);
  }
}

async function main() {
  const catalog = new Map();

  for (const [source, file] of manifestFiles) {
    const manifest = JSON.parse(await readFile(file, "utf8"));
    collectManifestEntries(manifest, source, catalog);
  }

  const plan = JSON.parse(await readFile(planFile, "utf8"));
  const errors = [];
  const plannedPaths = new Set();

  for (const groupId of requiredGroups) {
    const references = plan[groupId];
    if (!Array.isArray(references)) {
      errors.push(`Required group ${groupId} is missing or is not an array.`);
      continue;
    }
    if (groupId === "BOOT_CRITICAL" && references.length === 0) {
      errors.push("BOOT_CRITICAL must not be empty.");
    }

    const referencesSeen = new Set();
    const pathsSeen = new Set();
    for (const reference of references) {
      if (typeof reference !== "string") {
        errors.push(`${groupId} contains a non-string reference.`);
        continue;
      }
      if (referencesSeen.has(reference)) {
        errors.push(`${groupId} repeats semantic reference ${reference}.`);
      }
      referencesSeen.add(reference);

      const relativePath = catalog.get(reference);
      if (!relativePath) {
        errors.push(`${groupId} references unknown catalog entry ${reference}.`);
        continue;
      }
      const extension = path.extname(relativePath).toLowerCase();
      if (!supportedExtensions.has(extension)) {
        errors.push(`${groupId} uses unsupported media type: ${relativePath}.`);
      }
      if (pathsSeen.has(relativePath)) {
        errors.push(`${groupId} repeats physical asset ${relativePath}.`);
      }
      pathsSeen.add(relativePath);
      plannedPaths.add(relativePath);
    }
  }

  for (const groupId of Object.keys(plan)) {
    if (!requiredGroups.includes(groupId)) {
      errors.push(`Unexpected preload group ${groupId}.`);
    }
  }

  const catalogPaths = new Set(catalog.values());
  const unassigned = [...catalogPaths]
    .filter((relativePath) => !plannedPaths.has(relativePath))
    .sort((left, right) => left.localeCompare(right));
  for (const relativePath of unassigned) {
    if (!intentionallyUnassignedPaths.has(relativePath)) {
      errors.push(`Media required by the Phase 2 catalog is unassigned: ${relativePath}.`);
    }
  }
  for (const relativePath of intentionallyUnassignedPaths) {
    if (!catalogPaths.has(relativePath)) {
      errors.push(`Documented unassigned media is absent from the catalog: ${relativePath}.`);
    }
  }

  console.log("SOULBOUND preload plan validation");
  for (const groupId of requiredGroups) {
    const count = Array.isArray(plan[groupId]) ? plan[groupId].length : 0;
    console.log(`  ${groupId}: ${count} assets`);
  }
  console.log(`  Catalog media: ${catalogPaths.size}`);
  console.log(`  Unique planned media: ${plannedPaths.size}`);
  console.log(`  Unassigned media: ${unassigned.length}`);
  for (const relativePath of unassigned) {
    console.log(`    - ${relativePath}`);
  }

  if (errors.length > 0) {
    console.error("\nPreload plan validation failed:");
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log("Preload plan validation passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
