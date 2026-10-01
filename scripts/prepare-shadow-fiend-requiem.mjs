import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(repositoryRoot, "public", "assets", "REQ", "ShadowFiendREQ.mp4");
const output = path.join(repositoryRoot, "public", "assets", "REQ", "ShadowFiendREQ-keyed.webm");

if (!fs.existsSync(source)) {
  console.error(`Missing Requiem hero source: ${source}`);
  process.exit(1);
}

// The source is a 720px square gameplay capture. The first drawbox removes the
// static top-left capture label before keying. The keyed center HUD strip is
// reconstructed after the alpha pass so it reads as spell energy, not game UI.
// Audio is intentionally omitted: AUD-REQ-01..05 remain the only authority.
const videoFilter = [
  "drawbox=x=0:y=0:w=100:h=82:color=0x00ff00:t=fill",
  "format=rgba",
  "colorkey=0x00ff00:0.31:0.07",
  "despill=green:mix=1:expand=0.16",
  "colorkey=0x9b9f64:0.18:0.08",
  "colorkey=0x555d35:0.16:0.06",
  "delogo=x=298:y=277:w=132:h=25",
  "colorbalance=gs=-0.04:gm=-0.02",
  "eq=contrast=1.1:saturation=0.96:brightness=-0.02",
  "format=yuva420p",
].join(",");

const result = spawnSync("ffmpeg", [
  "-hide_banner",
  "-loglevel", "warning",
  "-i", source,
  "-map", "0:v:0",
  "-vf", videoFilter,
  "-an",
  "-c:v", "libvpx-vp9",
  "-pix_fmt", "yuva420p",
  "-auto-alt-ref", "0",
  "-b:v", "0",
  "-crf", "30",
  "-deadline", "good",
  "-cpu-used", "2",
  "-row-mt", "1",
  "-metadata:s:v:0", "alpha_mode=1",
  "-y",
  output,
], { cwd: repositoryRoot, stdio: "inherit" });

if (result.error) {
  console.error(`Unable to run ffmpeg: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);

const bytes = fs.statSync(output).size;
console.log(`Prepared ${path.relative(repositoryRoot, output)} (${bytes} bytes, VP9 alpha, silent).`);
