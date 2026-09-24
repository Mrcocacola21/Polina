import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const endpoint = process.env.SOULBOUND_CDP ?? "http://127.0.0.1:9223";
const appUrl = process.env.SOULBOUND_URL ?? "http://localhost:3000/?debug=1&soulSandbox=1&requiemSync=1";
const artifactDirectory = path.resolve(".next", "phase12-browser");
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const tabs = await fetch(`${endpoint}/json/list`).then((response) => response.json());
const page = tabs.find((tab) => tab.type === "page" && tab.url === "about:blank") ?? tabs.find((tab) => tab.type === "page");
if (!page?.webSocketDebuggerUrl) throw new Error("No Chromium page target is available.");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let sequence = 0;
const pending = new Map();
const browserErrors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails.text);
  if (message.method === "Log.entryAdded" && ["error", "warning"].includes(message.params.entry.level)) {
    browserErrors.push(message.params.entry.text);
  }
  if (!message.id) return;
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(message.error.message));
  else waiter.resolve(message.result);
});

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(label, expression, timeout = 35_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await sleep(90);
  }
  console.error(await evaluate(`({ url: location.href, body: document.body?.innerText?.slice(0, 3000), html: document.body?.innerHTML?.slice(0, 3000) })`));
  console.error(browserErrors);
  throw new Error(`Timed out waiting for ${label}.`);
}

async function screenshot(filename) {
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await fs.writeFile(path.join(artifactDirectory, filename), Buffer.from(result.data, "base64"));
}

async function snapshot() {
  return evaluate(`(() => {
    const director = document.querySelector('[data-testid="scene-director"]');
    const release = document.querySelector('[data-testid="souls-release-scene"]');
    const requiem = document.querySelector('[data-testid="requiem-scene"]');
    const hud = document.querySelector('[data-testid="soul-hud"]');
    const black = document.querySelector('[data-absolute-black]');
    return {
      scene: director?.getAttribute('data-scene-id'),
      phase: director?.getAttribute('data-scene-phase'),
      runId: director?.getAttribute('data-run-id'),
      releaseStatus: release?.getAttribute('data-release-status'),
      requiemStatus: requiem?.getAttribute('data-status'),
      rings: requiem?.getAttribute('data-rings'),
      requiemPhase: requiem?.getAttribute('data-requiem-phase'),
      cue: requiem?.getAttribute('data-current-cue'),
      soulPositions: requiem?.getAttribute('data-soul-positions'),
      video: requiem?.getAttribute('data-video-state'),
      releasedCount: release?.getAttribute('data-released-count') ?? requiem?.getAttribute('data-released-count'),
      count: hud?.querySelector('[data-testid="soul-count"]')?.textContent?.trim(),
      hudMode: hud?.getAttribute('data-hud-mode'),
      releaseState: hud?.getAttribute('data-release-state'),
      black: black?.getAttribute('data-absolute-black'),
      cursor: document.querySelector('[data-cursor-mode]')?.getAttribute('data-cursor-mode'),
      audio: document.querySelector('[data-testid="audio-active-counts"]')?.textContent?.trim() ?? ('A 0 · S ' + (document.querySelector('[data-testid="collection-audio-active"]')?.textContent?.trim() ?? '?') + ' · P ' + (document.querySelector('[data-testid="collection-procedural-active"]')?.textContent?.trim() ?? '?')),
      audioContext: document.querySelector('[data-testid="audio-context-state"]')?.textContent?.trim(),
      canvases: document.querySelectorAll('canvas').length,
      videosPlaying: [...document.querySelectorAll('video')].filter((video) => !video.paused).length,
      silenceText: document.querySelector('[data-testid="silence-boundary-scene"]')?.textContent ?? null,
    };
  })()`);
}

await fs.mkdir(artifactDirectory, { recursive: true });
await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: "about:blank" });
await sleep(120);
await send("Page.navigate", { url: appUrl });
await waitFor("Soul sandbox", `Boolean(document.querySelector('[data-testid="soul-collection-sandbox"]'))`, 25_000);
await sleep(2200);
await evaluate(`(() => {
  document.querySelector('[data-testid="collection-audio-unlock"]')?.click();
  [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'SEED 10')?.click();
})()`);
await waitFor("ten seeded Souls", `document.querySelector('[data-testid="collection-count"]')?.textContent?.trim() === '10 / 10'`, 8_000);
await evaluate(`(() => {
  const sandbox = document.querySelector('[data-testid="soul-collection-sandbox"]');
  if (sandbox instanceof HTMLElement) sandbox.style.display = 'none';
  const director = document.querySelector('[data-testid="scene-director"]');
  if (director instanceof HTMLElement) {
    director.style.opacity = '1';
    director.style.pointerEvents = 'auto';
    director.style.zIndex = '40';
  }
  window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: 'SOULS_RELEASE' } }));
})()`);
await waitFor("SOULS_RELEASE", `Boolean(document.querySelector('[data-testid="souls-release-scene"]'))`, 10_000);
await sleep(1800);
let state = await snapshot();
console.log("release snapshot", state);
console.log("browser errors", browserErrors);
assert.equal(state.scene, "SOULS_RELEASE");
assert.equal(state.count, "10 / 10");
assert.equal(state.releaseState, "RELEASED");
assert.equal(state.releasedCount, "10");
assert.equal(state.cursor, "HIDDEN");
assert.equal(state.canvases, 1);
await screenshot("release-detachment.png");

const releaseRunId = state.runId;
await evaluate(`window.dispatchEvent(new Event('soulbound:debug-restart-scene'))`);
await waitFor("release restart", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-run-id') !== '${releaseRunId}'`);
await waitFor("release replay", `document.querySelector('[data-testid="souls-release-scene"]')?.getAttribute('data-release-status') === 'released'`);
state = await snapshot();
assert.equal(state.releasedCount, "10");
assert.equal(state.count, "10 / 10");

await waitFor("REQUIEM", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'REQUIEM'`, 12_000);
await waitFor("Requiem ready", `document.querySelector('[data-testid="requiem-scene"]')?.getAttribute('data-status') === 'ready'`, 8_000);
await waitFor("Ring 2", `Number(document.querySelector('[data-testid="requiem-scene"]')?.getAttribute('data-rings')) >= 2`, 8_000);
state = await snapshot();
console.log("ring snapshot", state);
assert.equal(state.releasedCount, "10");
assert.equal(state.hudMode, "HIDDEN");
assert.equal(state.canvases, 1);
await screenshot("requiem-rings.png");

const firstRequiemRunId = state.runId;
await evaluate(`window.dispatchEvent(new Event('soulbound:debug-restart-scene'))`);
await waitFor("Requiem restart", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-run-id') !== '${firstRequiemRunId}'`);
await waitFor("restarted Requiem ready", `document.querySelector('[data-testid="requiem-scene"]')?.getAttribute('data-status') === 'ready'`, 8_000);
await waitFor("restarted arcs", `['arcs','compressed','hero','release'].includes(document.querySelector('[data-testid="requiem-scene"]')?.getAttribute('data-requiem-phase'))`, 8_000);
state = await snapshot();
assert.equal(state.scene, "REQUIEM");
assert.notEqual(state.black, "true");

await waitFor("primary hero release", `document.querySelector('[data-testid="requiem-scene"]')?.getAttribute('data-requiem-phase') === 'release'`, 8_000);
await waitFor("smoke playback result", `['playing','failed'].includes(document.querySelector('[data-testid="requiem-scene"]')?.getAttribute('data-video-state'))`, 3_000);
state = await snapshot();
assert.equal(state.video, "playing");
assert.equal(state.releasedCount, "10");
await screenshot("requiem-primary-impact.png");

await waitFor("SILENCE hard cut", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'SILENCE'`, 10_000);
await sleep(2500);
state = await snapshot();
assert.equal(state.phase, "active");
assert.equal(state.black, "true");
assert.equal(state.cursor, "HIDDEN");
assert.equal(state.hudMode, "HIDDEN");
assert.equal(state.releaseState, "RELEASED");
assert.equal(state.silenceText, "");
assert.equal(state.audio, "A 0 · S 0 · P 0");
assert.equal(state.videosPlaying, 0);
assert.equal(state.canvases, 1);
await evaluate(`document.querySelectorAll('[data-testid="scene-debug-overlay"], [data-testid="audio-debug-panel"], [data-testid="media-debug-panel"], [data-testid="asset-diagnostics"], nextjs-portal').forEach((node) => { if (node instanceof HTMLElement) node.style.display = 'none'; })`);
await screenshot("silence-black.png");

const seriousErrors = browserErrors.filter((message) =>
  !message.includes("favicon.ico") &&
  !message.includes("/_next/hmr") &&
  !message.includes("Failed to load resource: the server responded with a status of 404"),
);
assert.deepEqual(seriousErrors, []);
console.log(JSON.stringify({ ok: true, state, browserErrors: seriousErrors, artifacts: artifactDirectory }, null, 2));
socket.close();
