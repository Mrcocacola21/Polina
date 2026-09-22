import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const assetRoot = path.join(repositoryRoot, "public", "assets");

const manifests = [
  { label: "visual manifest", filename: "manifest.json" },
  { label: "audio manifest", filename: "audio-manifest.json" },
];

function collectPaths(value, location = "$", entries = []) {
  if (typeof value === "string") {
    entries.push({ assetPath: value, location });
    return entries;
  }

  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      collectPaths(child, `${location}.${key}`, entries);
    }
  }

  return entries;
}

function findDuplicates(entries) {
  const locationsByPath = new Map();

  for (const entry of entries) {
    const locations = locationsByPath.get(entry.assetPath) ?? [];
    locations.push(entry.location);
    locationsByPath.set(entry.assetPath, locations);
  }

  return [...locationsByPath.entries()].filter(([, locations]) => locations.length > 1);
}

function resolveAssetPath(assetPath) {
  if (typeof assetPath !== "string" || assetPath.length === 0) {
    throw new Error("Asset paths must be non-empty strings.");
  }

  if (path.isAbsolute(assetPath) || assetPath.includes("\\")) {
    throw new Error(`Asset path must be relative and use forward slashes: ${assetPath}`);
  }

  const resolvedPath = path.resolve(assetRoot, ...assetPath.split("/"));
  const relativePath = path.relative(assetRoot, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`Asset path escapes public/assets: ${assetPath}`);
  }

  return resolvedPath;
}

async function validateManifest({ label, filename }) {
  const manifestPath = path.join(assetRoot, filename);
  let parsed;

  try {
    parsed = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    return {
      label,
      filename,
      entries: [],
      duplicates: [],
      missing: [],
      errors: [`Could not parse ${manifestPath}: ${error.message}`],
    };
  }

  const entries = collectPaths(parsed);
  const duplicates = findDuplicates(entries);
  const missing = [];
  const errors = [];

  await Promise.all(
    entries.map(async ({ assetPath, location }) => {
      let resolvedPath;

      try {
        resolvedPath = resolveAssetPath(assetPath);
      } catch (error) {
        errors.push(`${location}: ${error.message}`);
        return;
      }

      try {
        const target = await stat(resolvedPath);
        if (!target.isFile()) {
          missing.push(`${assetPath} (${location}; target is not a file)`);
        }
      } catch {
        missing.push(`${assetPath} (${location})`);
      }
    }),
  );

  return { label, filename, entries, duplicates, missing, errors };
}

const results = await Promise.all(manifests.map(validateManifest));
const allEntries = results.flatMap((result) =>
  result.entries.map((entry) => ({ ...entry, manifest: result.filename })),
);
const crossManifestDuplicates = findDuplicates(
  allEntries.map((entry) => ({
    assetPath: entry.assetPath,
    location: `${entry.manifest}:${entry.location}`,
  })),
);

let failed = false;

for (const result of results) {
  console.log(
    `${result.label}: ${result.entries.length} paths, ${result.duplicates.length} duplicates, ${result.missing.length} missing`,
  );

  if (result.duplicates.length > 0) {
    failed = true;
    for (const [assetPath, locations] of result.duplicates) {
      console.error(`  duplicate: ${assetPath} (${locations.join(", ")})`);
    }
  }

  if (result.missing.length > 0) {
    failed = true;
    for (const missing of result.missing.sort()) {
      console.error(`  missing: ${missing}`);
    }
  }

  if (result.errors.length > 0) {
    failed = true;
    for (const error of result.errors) {
      console.error(`  error: ${error}`);
    }
  }
}

if (crossManifestDuplicates.length > 0) {
  failed = true;
  console.error(`cross-manifest duplicates: ${crossManifestDuplicates.length}`);
  for (const [assetPath, locations] of crossManifestDuplicates) {
    console.error(`  duplicate: ${assetPath} (${locations.join(", ")})`);
  }
}

if (failed) {
  console.error("Asset validation failed.");
  process.exitCode = 1;
} else {
  console.log(`asset validation passed: ${allEntries.length} total paths`);
}
