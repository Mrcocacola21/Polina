import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const assetRoot = path.join(repositoryRoot, "public", "assets");
const manifest = JSON.parse(await readFile(path.join(assetRoot, "manifest.json"), "utf8"));

const expected = {
  "soul.active": ["asset01", "Global/GLOBAL-01.png"],
  "soul.dormant": ["asset01VariantA", "Global/GLOBAL-01A.png"],
  "soul.charged": ["asset01VariantB", "Global/GLOBAL-01B.png"],
  "soul.trail": ["asset02", "Global/GLOBAL-02.png"],
  "particles.atlas": ["asset03", "Global/GLOBAL-03.png"],
  "fog.neutral": ["asset04VariantA", "Global/GLOBAL-04A.mp4"],
  "fog.crimson": ["asset04VariantB", "Global/GLOBAL-04B.mp4"],
  "fog.heavy": ["asset04VariantC", "Global/GLOBAL-04C.mp4"],
  "lightLeak.crimson": ["asset07", "Global/GLOBAL-07.png"],
  "transition.organic": ["asset09VariantA", "Global/GLOBAL-09A.png"],
  "transition.smoke": ["asset09VariantB", "Global/GLOBAL-09B.png"],
  "transition.soulCircle": ["asset09VariantC", "Global/GLOBAL-09C.png"],
  "transition.verticalSlit": ["asset09VariantD", "Global/GLOBAL-09D.png"],
};

const errors = [];
for (const [semanticName, [manifestKey, expectedPath]] of Object.entries(expected)) {
  const actualPath = manifest.global?.[manifestKey];
  if (actualPath !== expectedPath) {
    errors.push(`${semanticName}: expected manifest global.${manifestKey} to be ${expectedPath}, received ${String(actualPath)}`);
    continue;
  }
  const resolved = path.resolve(assetRoot, ...actualPath.split("/"));
  const relative = path.relative(assetRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    errors.push(`${semanticName}: path escapes public/assets`);
    continue;
  }
  try {
    const target = await stat(resolved);
    if (!target.isFile()) errors.push(`${semanticName}: target is not a file`);
  } catch {
    errors.push(`${semanticName}: missing ${actualPath}`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`visual mapping error: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`visual validation passed: ${Object.keys(expected).length} semantic mappings`);
}
