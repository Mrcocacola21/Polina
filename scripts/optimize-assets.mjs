import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const masterRoot = path.join(root, "public", "assets");
const outputRoot = path.join(root, "public", "assets-optimized");
const manifestPath = path.join(outputRoot, "manifest.json");

const IMAGE_MASTERS = [
  "BRAND/BRAND-02.png",
  "FIN/FIN-01.png",
  "FIN/FIN-01A.png",
  "FIN/FIN-01B.png",
  "FIN/FIN-01C.png",
  "FIN/FIN-02.png",
  "REQ/REQ-02.png",
  "REQ/REQ-03.png",
  "S/S01-01.png",
  "S/S03-02.png",
  "S/S03-04.png",
  "S/S05-01.png",
  "S/S05-02.png",
  "S/S07-01.png",
  "S/S07-05.png",
  "S/S08-01.png",
  "S/S08-02.png",
  "S/S08-03.png",
  "S/S09-01.png",
  "S/S09-03.png",
  "S/S09-04.png",
  "S/S10-01.png",
  "S/S10-02A.png",
  "S/S10-02B.png",
  "S/S10-02C.png",
  "Screens/discord.png",
  "Screens/good-morning.png",
  "Screens/heart-reaction.png",
  "Screens/minecraft-together.png",
  "Screens/pain.png",
  "Screens/polina.png",
  "Screens/queen-cant-die.png",
];

const MOBILE_IMAGE_MASTERS = new Set([
  "FIN/FIN-01A.png",
  "FIN/FIN-01B.png",
  "FIN/FIN-01C.png",
]);

const STREAM_AUDIO = [
  ["sfx/MUS-01.wav", 128_000],
  ["sfx/MUS-02.wav", 128_000],
  ["sfx/MUS-03.wav", 128_000],
  ["sfx/MUS-04.wav", 128_000],
  ["sfx/AUD-S01-01.wav", 96_000],
  ["sfx/AUD-S03-03.wav", 96_000],
  ["sfx/AUD-S05-01.wav", 96_000],
  ["sfx/AUD-S09-01.wav", 96_000],
  ["sfx/AUD-S09-02.wav", 96_000],
];

const VIDEO_MASTERS = [
  "REQ/REQ-04.mp4",
  "S/S09-02.mp4",
  "Screens/polina-circle.mp4",
];

const normalize = (value) => value.replaceAll("\\", "/");
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

function requireFfmpeg() {
  const result = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error("ffmpeg is required to generate optimized audio/video variants.");
  }
}

function safeOutputPath(relativePath) {
  const resolved = path.resolve(outputRoot, ...relativePath.split("/"));
  const relative = path.relative(outputRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Generated path escapes public/assets-optimized: ${relativePath}`);
  }
  return resolved;
}

async function removePreviousOutputs() {
  let previous;
  try {
    previous = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    return;
  }
  const paths = Object.values(previous.assets ?? {}).flatMap((entry) =>
    Array.isArray(entry.variants) ? entry.variants.map((variant) => variant.path) : [],
  );
  for (const relativePath of paths) {
    if (typeof relativePath !== "string") continue;
    await rm(safeOutputPath(relativePath), { force: true });
  }
}

async function finalizeTemporary(tempPath, folder, stem, extension) {
  const bytes = await readFile(tempPath);
  const sha256 = digest(bytes);
  const relativePath = normalize(path.join(folder, `${stem}.${sha256.slice(0, 12)}.${extension}`));
  const finalPath = safeOutputPath(relativePath);
  await mkdir(path.dirname(finalPath), { recursive: true });
  await rm(finalPath, { force: true });
  await rename(tempPath, finalPath);
  return { path: relativePath, bytes: bytes.length, sha256 };
}

async function masterInfo(relativePath) {
  const absolutePath = path.join(masterRoot, ...relativePath.split("/"));
  const bytes = await readFile(absolutePath);
  return {
    absolutePath,
    bytes: bytes.length,
    sha256: digest(bytes),
  };
}

async function optimizeImage(relativePath) {
  const source = await masterInfo(relativePath);
  const metadata = await sharp(source.absolutePath).metadata();
  const stem = path.basename(relativePath, path.extname(relativePath));
  const folder = normalize(path.join("images", path.dirname(relativePath)));
  const variants = [];

  const fullTemp = safeOutputPath(normalize(path.join(folder, `${stem}.full.tmp.webp`)));
  await mkdir(path.dirname(fullTemp), { recursive: true });
  await sharp(source.absolutePath).webp({ lossless: true, effort: 6 }).toFile(fullTemp);
  variants.push({
    ...(await finalizeTemporary(fullTemp, folder, stem, "webp")),
    profile: "default",
    mimeType: "image/webp",
    width: metadata.width,
    height: metadata.height,
    lossless: true,
  });

  if (MOBILE_IMAGE_MASTERS.has(relativePath)) {
    const mobileTemp = safeOutputPath(normalize(path.join(folder, `${stem}.mobile.tmp.webp`)));
    await sharp(source.absolutePath)
      .resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
      .webp({ lossless: true, effort: 6 })
      .toFile(mobileTemp);
    const scale = Math.min(1, 2048 / Math.max(metadata.width ?? 2048, metadata.height ?? 2048));
    variants.push({
      ...(await finalizeTemporary(mobileTemp, folder, `${stem}.mobile`, "webp")),
      profile: "mobile",
      mimeType: "image/webp",
      width: Math.round((metadata.width ?? 2048) * scale),
      height: Math.round((metadata.height ?? 2048) * scale),
      lossless: true,
    });
  }

  return {
    kind: "image",
    master: { path: relativePath, bytes: source.bytes, sha256: source.sha256 },
    variants,
  };
}

function probeDuration(absolutePath) {
  const result = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", absolutePath],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(`ffprobe failed for ${absolutePath}`);
  const duration = Number(result.stdout.trim());
  if (!Number.isFinite(duration)) throw new Error(`Invalid duration for ${absolutePath}`);
  return Number(duration.toFixed(6));
}

async function optimizeAudio(relativePath, bitrate) {
  const source = await masterInfo(relativePath);
  const sourceDuration = probeDuration(source.absolutePath);
  const stem = path.basename(relativePath, path.extname(relativePath));
  const folder = normalize(path.join("audio", path.dirname(relativePath)));
  const tempPath = safeOutputPath(normalize(path.join(folder, `${stem}.tmp.webm`)));
  await mkdir(path.dirname(tempPath), { recursive: true });
  const result = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", source.absolutePath,
    "-map", "0:a:0", "-c:a", "libopus", "-b:a", String(bitrate), "-vbr", "on",
    "-compression_level", "10", "-application", "audio", tempPath,
  ], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`ffmpeg audio conversion failed: ${relativePath}`);
  const finalized = await finalizeTemporary(tempPath, folder, stem, "webm");
  const outputDuration = probeDuration(safeOutputPath(finalized.path));
  if (Math.abs(outputDuration - sourceDuration) > 0.08) {
    throw new Error(`Audio duration drift exceeds 80ms for ${relativePath}.`);
  }
  return {
    kind: "audio",
    usage: "stream",
    master: { path: relativePath, bytes: source.bytes, sha256: source.sha256, duration: sourceDuration },
    variants: [{
      ...finalized,
      profile: "default",
      mimeType: "audio/webm; codecs=opus",
      codec: "opus",
      bitrate,
      duration: outputDuration,
    }],
  };
}

async function optimizeVideo(relativePath) {
  const source = await masterInfo(relativePath);
  const sourceDuration = probeDuration(source.absolutePath);
  const stem = path.basename(relativePath, path.extname(relativePath));
  const folder = normalize(path.join("video", path.dirname(relativePath)));
  const tempPath = safeOutputPath(normalize(path.join(folder, `${stem}.tmp.mp4`)));
  await mkdir(path.dirname(tempPath), { recursive: true });
  const result = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", source.absolutePath,
    "-map", "0:v:0", "-c:v", "copy", "-an", "-movflags", "+faststart", tempPath,
  ], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`ffmpeg video remux failed: ${relativePath}`);
  const finalized = await finalizeTemporary(tempPath, folder, stem, "mp4");
  const outputDuration = probeDuration(safeOutputPath(finalized.path));
  if (Math.abs(outputDuration - sourceDuration) > 0.04) {
    throw new Error(`Video duration drift exceeds 40ms for ${relativePath}.`);
  }
  return {
    kind: "video",
    master: { path: relativePath, bytes: source.bytes, sha256: source.sha256, duration: sourceDuration },
    variants: [{
      ...finalized,
      profile: "default",
      mimeType: "video/mp4",
      codec: "h264-copy",
      duration: outputDuration,
      audioRemoved: true,
    }],
  };
}

async function main() {
  requireFfmpeg();
  await mkdir(outputRoot, { recursive: true });
  await removePreviousOutputs();
  const assets = {};

  for (const relativePath of IMAGE_MASTERS) {
    assets[relativePath] = await optimizeImage(relativePath);
  }
  for (const [relativePath, bitrate] of STREAM_AUDIO) {
    assets[relativePath] = await optimizeAudio(relativePath, bitrate);
  }
  for (const relativePath of VIDEO_MASTERS) {
    assets[relativePath] = await optimizeVideo(relativePath);
  }

  const manifest = { version: 1, assets };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const sourceBytes = Object.values(assets).reduce((total, entry) => total + entry.master.bytes, 0);
  const deliveryBytes = Object.values(assets).reduce(
    (total, entry) => total + (entry.variants.find((variant) => variant.profile === "default")?.bytes ?? 0),
    0,
  );
  const manifestBytes = (await stat(manifestPath)).size;
  console.log(JSON.stringify({
    assets: Object.keys(assets).length,
    sourceBytes,
    deliveryBytes,
    reduction: Number((1 - deliveryBytes / sourceBytes).toFixed(4)),
    manifestBytes,
    output: normalize(path.relative(root, manifestPath)),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
