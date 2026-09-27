import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const endpoint = process.env.SOULBOUND_CDP ?? "http://127.0.0.1:9222";
const origin = process.env.SOULBOUND_ORIGIN ?? "http://localhost:3000";
const requestedScenes = new Set(
  (process.env.SOULBOUND_QA_SCENES ?? "").split(",").map((value) => value.trim()).filter(Boolean),
);
const sceneRequested = (sceneId) => requestedScenes.size === 0 || requestedScenes.has(sceneId);
const screenshotDirectory = path.resolve(".next", "production-soul-qa");
await mkdir(screenshotDirectory, { recursive: true });
const tabs = await fetch(`${endpoint}/json/list`).then((response) => response.json());
const page = tabs.find((tab) => tab.type === "page");
if (!page?.webSocketDebuggerUrl) throw new Error("No Chromium page target is available.");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let id = 0;
const pending = new Map();
const browserErrors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails.text);
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(message.error.message));
  else waiter.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const callId = ++id;
  pending.set(callId, { resolve, reject });
  socket.send(JSON.stringify({ id: callId, method, params }));
});
const evaluate = async (expression) => {
  const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
};
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const waitFor = async (label, expression, timeout = 55_000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}.`);
};
const setViewport = (width, height, mobile = false) => send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
const capture = async (name) => {
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(path.join(screenshotDirectory, `${name}.png`), Buffer.from(result.data, "base64"));
};
const targetGeometry = () => evaluate(`(() => { const target = document.querySelector('[data-testid="soul-claim-target"]'); const rect = target?.getBoundingClientRect(); return rect && { soulId: target.dataset.soulId, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width, height: rect.height, safe: target.dataset.viewportSafe, issues: target.dataset.visibilityIssues, screen: target.dataset.screenPosition?.split(',').map(Number), scale: Number(target.dataset.visualScale), opacity: Number(target.dataset.visualOpacity), order: Number(target.dataset.renderOrder) }; })()`);

async function boot(width, height, mobile = false) {
  await setViewport(width, height, mobile);
  await send("Page.navigate", { url: `${origin}/?debug=1` });
  await waitFor("debug director", `Boolean(document.querySelector('[data-testid="scene-debug-overlay"]'))`, 45_000);
  await evaluate(`localStorage.clear(); sessionStorage.clear()`);
  await send("Page.reload", { ignoreCache: true });
  await waitFor("debug director reload", `Boolean(document.querySelector('[data-testid="scene-debug-overlay"]'))`, 45_000);
  await evaluate(`for (const id of ['scene-debug-overlay','media-debug-panel','performance-debug-panel','audio-debug-panel']) { const element = document.querySelector('[data-testid="' + id + '"]'); if (element) element.style.display = 'none'; }`);
}

async function activateScene(sceneId) {
  if (sceneId === "S05") {
    await waitFor("S05 morning target", `!document.querySelector('[data-testid="morning-light-target"]')?.disabled`);
    await evaluate(`document.querySelector('[data-testid="morning-light-target"]').click()`);
  }
  if (sceneId === "S06") {
    await waitFor("S06 heart target", `!document.querySelector('[data-testid="heart-reaction-hotspot"]')?.disabled`);
    await evaluate(`document.querySelector('[data-testid="heart-reaction-hotspot"]').click()`);
  }
  if (sceneId === "S09") {
    await waitFor("S09 hold control", `Boolean(document.querySelector('[data-testid="s09-scene"] button:not(:disabled)'))`);
    await evaluate(`document.querySelector('[data-testid="s09-scene"] button:not(:disabled)').focus()`);
    await send("Input.dispatchKeyEvent", { type: "keyDown", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
    await delay(3_000);
    await send("Input.dispatchKeyEvent", { type: "keyUp", key: " ", code: "Space", windowsVirtualKeyCode: 32 });
  }
}

const results = [];
async function inspectScene(sceneId, soulId, viewportLabel) {
  await evaluate(`window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: '${sceneId}' } }))`);
  await waitFor(`${sceneId} active`, `document.querySelector('[data-testid="scene-director"]')?.dataset.sceneId === '${sceneId}' && document.querySelector('[data-testid="scene-director"]')?.dataset.scenePhase === 'active'`);
  await activateScene(sceneId);
  await waitFor(`${soulId} WAITING`, `document.querySelector('[data-testid="soul-claim-target"]')?.dataset.soulId === '${soulId}'`);
  await delay(5_000);
  const target = await targetGeometry();
  assert.equal(target.soulId, soulId);
  assert.equal(target.safe, "true");
  assert.equal(target.issues, "");
  assert.ok(target.scale > 0);
  assert.ok(target.opacity >= 0.88);
  assert.equal(target.order, 100);
  assert.ok(Math.hypot(target.screen[0] - target.x, target.screen[1] - target.y) <= 2);
  await capture(`${viewportLabel}-${sceneId.toLowerCase()}-${soulId.toLowerCase()}`);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 16, y: 16 });
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: target.x, y: target.y });
  await waitFor(`${soulId} collected`, `document.querySelector('[data-testid="debug-collection-status"]')?.textContent === 'COLLECTED'`, 20_000);
  results.push({ viewportLabel, sceneId, ...target });
}

await send("Runtime.enable");
await send("Page.enable");
await boot(1920, 1080);
for (const [sceneId, soulId] of [
  ["S01", "SOUL_01"], ["S03", "SOUL_03"], ["S05", "SOUL_05"], ["S06", "SOUL_06"],
  ["S07", "SOUL_07"], ["S08", "SOUL_08"], ["S09", "SOUL_09"], ["S10", "SOUL_10"],
].filter(([sceneId]) => sceneRequested(sceneId))) await inspectScene(sceneId, soulId, "1920x1080");

if (process.env.SOULBOUND_QA_SKIP_1440 !== "1") {
  await boot(2560, 1440);
  for (const [sceneId, soulId] of [["S01", "SOUL_01"], ["S07", "SOUL_07"], ["S09", "SOUL_09"], ["S10", "SOUL_10"]].filter(([sceneId]) => sceneRequested(sceneId))) {
    await inspectScene(sceneId, soulId, "2560x1440");
  }
}

assert.deepEqual(browserErrors, []);
console.log(JSON.stringify({ ok: true, screenshotDirectory, results }, null, 2));
socket.close();
