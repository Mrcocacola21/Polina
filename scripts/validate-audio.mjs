import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repositoryRoot = process.cwd();
const assetsRoot = path.join(repositoryRoot, "public", "assets");
const manifestFile = path.join(assetsRoot, "audio-manifest.json");
const mappingFile = path.join(
  repositoryRoot,
  "src",
  "lib",
  "audio",
  "audio-map.json",
);
const expectedMusic = {
  NIGHT: "sfx/MUS-01.wav",
  MEMORIES: "sfx/MUS-02.wav",
  VULNERABILITY: "sfx/MUS-03.wav",
  HEART_AND_SOUL: "sfx/MUS-04.wav",
};
const requiredAmbient = [
  "LATE_NIGHT_ROOM",
  "MEMORY_SPACE",
  "MORNING_ROOM",
  "PAIN_DRONE",
  "SPARSE_RAIN",
];

function collect(value, keys = [], entries = new Map()) {
  if (typeof value === "string") {
    entries.set(`audio:${keys.join(".")}`, value.replaceAll("\\", "/"));
    return entries;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid audio manifest node at ${keys.join(".") || "root"}.`);
  }
  for (const [key, child] of Object.entries(value)) {
    collect(child, [...keys, key], entries);
  }
  return entries;
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  const mapping = JSON.parse(await readFile(mappingFile, "utf8"));
  const catalog = collect(manifest);
  const errors = [];
  const mappedRefs = [
    ...Object.values(mapping.music ?? {}),
    ...Object.values(mapping.ambient ?? {}),
    ...Object.values(mapping.voice ?? {}),
    mapping.requiem,
  ];

  for (const [state, expectedPath] of Object.entries(expectedMusic)) {
    const reference = mapping.music?.[state];
    if (!reference) {
      errors.push(`Missing semantic music state ${state}.`);
      continue;
    }
    if (catalog.get(reference) !== expectedPath) {
      errors.push(`${state} must resolve to ${expectedPath}.`);
    }
  }

  for (const state of requiredAmbient) {
    if (!mapping.ambient?.[state]) {
      errors.push(`Missing semantic ambient state ${state}.`);
    }
  }

  for (const reference of mappedRefs) {
    if (typeof reference !== "string" || !catalog.has(reference)) {
      errors.push(`Unknown semantic audio mapping: ${String(reference)}.`);
    }
  }

  for (const [reference, relativePath] of catalog) {
    try {
      await access(path.join(assetsRoot, relativePath));
    } catch {
      errors.push(`${reference} points to missing file ${relativePath}.`);
    }
  }

  const longFormRefs = new Set([
    ...Object.values(mapping.music ?? {}),
    ...Object.values(mapping.ambient ?? {}),
  ]);
  console.log("SOULBOUND audio validation");
  console.log(`  Manifest audio: ${catalog.size}`);
  console.log(`  Music states: ${Object.keys(mapping.music ?? {}).length}`);
  console.log(`  Ambient states: ${Object.keys(mapping.ambient ?? {}).length}`);
  console.log(`  Long-form streams: ${longFormRefs.size}`);
  console.log(`  Lazy decoded SFX: ${catalog.size - longFormRefs.size}`);

  if (errors.length > 0) {
    console.error("Audio validation failed:");
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log("Audio validation passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
