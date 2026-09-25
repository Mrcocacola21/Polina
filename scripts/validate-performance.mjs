import { readFile } from "node:fs/promises";
import process from "node:process";

const read = (file) => readFile(file, "utf8");
const [quality, runtime, preloader, plan, video, objects, root, director, config] = await Promise.all([
  read("src/lib/visuals/quality.ts"), read("src/lib/visuals/VisualRuntime.ts"),
  read("src/lib/media/media-preloader.ts"), read("src/lib/media/preload-plan.json"),
  read("src/components/media/MediaVideo.tsx"), read("src/components/visuals/VisualObjects.tsx"),
  read("src/components/visuals/GlobalVisualRoot.tsx"), read("src/components/cinematic/SceneDirector.tsx"), read("next.config.ts"),
]);
const checks = [
  [quality.includes("AdaptiveQualityController") && quality.includes("5_000") && quality.includes("8_000"), "adaptive hysteresis/cooldown"],
  [runtime.includes("targetCount") && runtime.includes("sampleFrame"), "runtime particle adaptation"],
  [preloader.includes("DEFAULT_PRELOAD_CONCURRENCY = 3"), "bounded preload concurrency"],
  [plan.includes('"BEFORE_REQUIEM"') && plan.includes('"BEFORE_FINAL"'), "staged critical loading"],
  [video.includes('removeAttribute("src")') && video.includes("video.load()"), "video decoder cleanup"],
  [!objects.includes("trail.slice(-64)") && objects.includes("sampleStart"), "allocation-free trail sampling"],
  [root.includes("dynamic(") && director.includes("PerformanceDebugPanel") && director.includes("dynamic("), "lazy debug tooling"],
  [config.includes("immutable") && config.includes("assets-optimized"), "immutable optimized cache policy"],
];
for (const [ok, label] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (checks.some(([ok]) => !ok)) process.exitCode = 1;
