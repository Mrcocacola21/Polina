import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const endpoint = process.env.SOULBOUND_CDP ?? "http://127.0.0.1:9222";
const origin = process.env.SOULBOUND_ORIGIN ?? "http://localhost:3000";
const screenshotDirectory = path.resolve(".next", "waiting-soul-qa");
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
const waitFor = async (label, expression, timeout = 30_000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await delay(80);
  }
  throw new Error(`Timed out waiting for ${label}.`);
};
const clickTestId = async (testId) => {
  assert.equal(await evaluate(`document.querySelectorAll('[data-testid="${testId}"]').length`), 1);
  await evaluate(`document.querySelector('[data-testid="${testId}"]').click()`);
};
const setSoul = (soulId) => evaluate(`(() => { const select = [...document.querySelectorAll('select')].find((element) => [...element.options].some((option) => option.value === '${soulId}')); if (!select) return false; select.value = '${soulId}'; select.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
const geometry = () => evaluate(`(() => { const target = document.querySelector('[data-testid="soul-claim-target"]'); const rect = target?.getBoundingClientRect(); return rect && { soulId: target.dataset.soulId, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width, height: rect.height, safe: target.dataset.viewportSafe, issues: target.dataset.visibilityIssues, screen: target.dataset.screenPosition?.split(',').map(Number), scale: Number(target.dataset.visualScale), opacity: Number(target.dataset.visualOpacity), order: Number(target.dataset.renderOrder) }; })()`);
const capture = async (name) => {
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(path.join(screenshotDirectory, `${name}.png`), Buffer.from(result.data, "base64"));
};
const setViewport = async (width, height, mobile = false) => {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
};

await send("Runtime.enable");
await send("Page.enable");
await setViewport(1920, 1080);
await send("Page.navigate", { url: `${origin}/?debug=1&soulSandbox=1` });
await waitFor("Soul sandbox", `Boolean(document.querySelector('[data-testid="soul-collection-sandbox"]'))`, 40_000);

const results = [];
async function inspectSoul(soulId, label, idleMilliseconds = 5_000) {
  await clickTestId("reset-souls");
  assert.equal(await setSoul(soulId), true);
  await clickTestId("collect-point");
  await waitFor(`${soulId} WAITING`, `document.querySelector('[data-testid="claim-stage"]')?.textContent === 'WAITING'`);
  await delay(idleMilliseconds);
  const target = await geometry();
  assert.equal(target.soulId, soulId);
  assert.equal(target.safe, "true");
  assert.equal(target.issues, "");
  assert.ok(target.width >= 108 && target.height >= 108);
  assert.ok(target.scale > 0);
  assert.ok(target.opacity >= 0.88);
  assert.equal(target.order, 100);
  assert.ok(Math.hypot(target.screen[0] - target.x, target.screen[1] - target.y) <= 2);
  await capture(`${label}-${soulId.toLowerCase()}`);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 20, y: 20 });
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: target.x, y: target.y });
  await waitFor(`${soulId} hover claim`, `document.querySelector('[data-testid="collection-count"]')?.textContent?.trim() === '1 / 10'`);
  results.push({ label, ...target });
}

for (const soulId of ["SOUL_01", "SOUL_02", "SOUL_03", "SOUL_04", "SOUL_05", "SOUL_06", "SOUL_07", "SOUL_08", "SOUL_09", "SOUL_10"]) {
  await inspectSoul(soulId, "1920x1080");
}

await clickTestId("reset-souls");
assert.equal(await setSoul("SOUL_01"), true);
await clickTestId("collect-point");
await waitFor("SOUL_01 pre-resize WAITING", `document.querySelector('[data-testid="claim-stage"]')?.textContent === 'WAITING'`);
await setViewport(1366, 768);
await delay(500);
const resizedTarget = await geometry();
assert.equal(resizedTarget.soulId, "SOUL_01");
assert.equal(resizedTarget.safe, "true");
assert.equal(resizedTarget.issues, "");
assert.ok(Math.hypot(resizedTarget.screen[0] - resizedTarget.x, resizedTarget.screen[1] - resizedTarget.y) <= 2);
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: resizedTarget.x, y: resizedTarget.y });
await waitFor("SOUL_01 post-resize hover claim", `document.querySelector('[data-testid="collection-count"]')?.textContent?.trim() === '1 / 10'`);
results.push({ label: "live-resize-1366x768", ...resizedTarget });

await setViewport(2560, 1440);
for (const soulId of ["SOUL_01", "SOUL_07", "SOUL_09", "SOUL_10"]) {
  await inspectSoul(soulId, "2560x1440-long-idle", 30_000);
}

await setViewport(390, 844, true);
for (const soulId of ["SOUL_01", "SOUL_10"]) {
  await inspectSoul(soulId, "390x844", 1_000);
}

await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
await inspectSoul("SOUL_10", "reduced-motion", 1_000);

await setViewport(1280, 720);
await clickTestId("reset-souls");
assert.equal(await setSoul("SOUL_01"), true);
await clickTestId("collect-point");
await waitFor("fallback setup WAITING", `document.querySelector('[data-testid="claim-stage"]')?.textContent === 'WAITING'`);
await evaluate(`document.querySelector('[data-testid="global-webgl-canvas"] canvas')?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext()`);
await waitFor("DOM fallback", `Boolean(document.querySelector('[data-testid="webgl-dom-fallback"]'))`);
await capture("fallback-soul-01");
assert.equal((await geometry()).issues, "");

assert.deepEqual(browserErrors, []);
console.log(JSON.stringify({
  ok: true,
  screenshotDirectory,
  checks: ["all-ten-1920x1080", "live-resize", "representative-2560x1440", "mobile", "reduced-motion", "dom-fallback", "hit-alignment", "hover-claim"],
  results,
}, null, 2));
socket.close();
