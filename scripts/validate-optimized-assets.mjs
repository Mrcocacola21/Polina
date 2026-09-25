import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = process.cwd();
const masterRoot = path.join(root, "public", "assets");
const outputRoot = path.join(root, "public", "assets-optimized");
const manifest = JSON.parse(await readFile(path.join(outputRoot, "manifest.json"), "utf8"));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const errors = [];
const referenced = new Set(["manifest.json"]);

async function filesUnder(folder, prefix = "") {
  const result = [];
  for (const item of await readdir(folder, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, item.name);
    if (item.isDirectory()) result.push(...await filesUnder(path.join(folder, item.name), relative));
    else result.push(relative);
  }
  return result;
}

for (const [key, entry] of Object.entries(manifest.assets ?? {})) {
  const masterPath = path.join(masterRoot, ...key.split("/"));
  const master = await readFile(masterPath);
  if (entry.master.path !== key) errors.push(`${key}: master path mismatch`);
  if (entry.master.bytes !== master.length || entry.master.sha256 !== sha(master)) errors.push(`${key}: master integrity mismatch`);
  if (!Array.isArray(entry.variants) || entry.variants.length === 0) errors.push(`${key}: no delivery variant`);
  for (const variant of entry.variants ?? []) {
    referenced.add(variant.path);
    const absolute = path.resolve(outputRoot, ...variant.path.split("/"));
    if (!absolute.startsWith(`${path.resolve(outputRoot)}${path.sep}`)) errors.push(`${key}: output escapes root`);
    const bytes = await readFile(absolute);
    if (bytes.length === 0 || bytes.length !== variant.bytes || sha(bytes) !== variant.sha256) errors.push(`${key}: variant integrity mismatch`);
    if (!path.basename(variant.path).includes(variant.sha256.slice(0, 12))) errors.push(`${key}: filename is not content hashed`);
  }
  if (entry.kind === "image") {
    const source = await sharp(masterPath).flatten({ background: "#000" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const primary = entry.variants.find((variant) => variant.profile === "default");
    const delivery = await sharp(path.join(outputRoot, ...primary.path.split("/"))).flatten({ background: "#000" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    if (source.info.width !== delivery.info.width || source.info.height !== delivery.info.height || !source.data.equals(delivery.data)) {
      errors.push(`${key}: default image is not pixel-exact when composited on the locked black canvas`);
    }
  }
}

const actual = await filesUnder(outputRoot);
for (const file of actual) if (!referenced.has(file)) errors.push(`unreferenced generated file: ${file}`);
for (const file of referenced) if (!actual.includes(file)) errors.push(`missing generated file: ${file}`);

const requiem = await readFile(path.join(masterRoot, "sfx", "AUD-REQ-05.mp3"));
if (sha(requiem) !== "2b4c713927df826d9c45d5b4643afb21f3627dd731e3e0bd6a0ad18461f5efc8") errors.push("AUD-REQ-05 master changed");
if (manifest.assets["sfx/AUD-REQ-05.mp3"]) errors.push("AUD-REQ-05 must not be transcoded");

const sourceBytes = Object.values(manifest.assets).reduce((sum, entry) => sum + entry.master.bytes, 0);
const deliveryBytes = Object.values(manifest.assets).reduce((sum, entry) => sum + entry.variants.find((variant) => variant.profile === "default").bytes, 0);
console.log(`Optimized assets: ${Object.keys(manifest.assets).length}; ${(sourceBytes / 1e6).toFixed(1)} MB -> ${(deliveryBytes / 1e6).toFixed(1)} MB (${((1 - deliveryBytes / sourceBytes) * 100).toFixed(1)}% reduction).`);
if (errors.length) {
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else console.log("Optimized asset validation passed (hashes, inventory, lossless pixels, fallback masters). ");
