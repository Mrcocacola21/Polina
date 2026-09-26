import { readFile } from "node:fs/promises";
import process from "node:process";

const read = (file) => readFile(file, "utf8");
const [fallbacks, video, image, preloader, cache, webgl, audio, recovery, director, errorBoundary, failureLab] = await Promise.all([
  read("src/lib/media/fallbacks.ts"),
  read("src/components/media/MediaVideo.tsx"),
  read("src/components/media/MediaImage.tsx"),
  read("src/lib/media/media-preloader.ts"),
  read("src/lib/media/cache.ts"),
  read("src/components/visuals/GlobalWebGLCanvas.tsx"),
  read("src/lib/audio/AudioEngine.ts"),
  read("src/lib/cinematic/recovery.ts"),
  read("src/components/cinematic/SceneDirector.tsx"),
  read("src/app/error.tsx"),
  read("src/components/accessibility/FailureLab.tsx"),
]);

const checks = [
  [fallbacks.includes("polinaCircle") && fallbacks.includes("section09Asset02") && fallbacks.includes("requirements.asset04") && fallbacks.includes("asset04VariantA") && fallbacks.includes("asset04VariantB") && fallbacks.includes("asset04VariantC"), "all production videos have fallback policy"],
  [video.includes("onError") && video.includes("safePlayVideo") && video.includes("data-fallback-kind"), "video errors and play rejection settle to fallback"],
  [image.includes("onError") && image.includes("failed"), "image errors settle to fallback"],
  [preloader.includes('status: "failed"') && cache.includes("markFailed"), "preloader failures settle and remain cached"],
  [webgl.includes("webglcontextlost") && webgl.includes("DomVisualFallback") && webgl.includes("fallbackScreenToWorld") === false, "WebGL loss selects persistent DOM fallback"],
  [audio.includes("AudioContextConstructor") && audio.includes("resumeAfterVisibility") && audio.includes("unavailable"), "audio unavailable and interruption paths"],
  [recovery.includes("RECOVERY_VERSION") && recovery.includes("RECOVERY_MAX_AGE_MS") && recovery.includes("safeRecoveryScene"), "versioned expiring safe recovery schema"],
  [director.includes("readRecovery") && director.includes("restoreCollectedSouls") && director.includes("30_000"), "recovery hydration and transition watchdog"],
  [errorBoundary.includes("Повторить") && errorBoundary.includes("Перезапустить"), "fatal runtime retry UI"],
  [failureLab.includes("FAIL IMAGE") && failureLab.includes("NO WEBGL") && failureLab.includes("CLEAR RECOVERY"), "development FailureLab"],
];

for (const [ok, label] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
if (checks.some(([ok]) => !ok)) process.exitCode = 1;
