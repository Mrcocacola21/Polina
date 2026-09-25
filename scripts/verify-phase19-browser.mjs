import assert from "node:assert/strict";
import process from "node:process";

const endpoint = process.env.SOULBOUND_CDP ?? "http://127.0.0.1:9231";
const origin = process.env.SOULBOUND_ORIGIN ?? "http://localhost:3001";
const tabs = await fetch(`${endpoint}/json/list`).then((response) => response.json());
const page = tabs.find((tab) => tab.type === "page" && tab.url === "about:blank") ?? tabs.find((tab) => tab.type === "page");
if (!page?.webSocketDebuggerUrl) throw new Error("No Chromium page target is available.");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
let id = 0;
const pending = new Map();
const errors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(message.error.message));
  else waiter.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const callId = ++id; pending.set(callId, { resolve, reject }); socket.send(JSON.stringify({ id: callId, method, params })); });
const evaluate = async (expression) => { const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.text); return result.result.value; };
const waitFor = async (expression, timeout = 20_000) => { const started = Date.now(); while (Date.now() - started < timeout) { if (await evaluate(expression)) return; await new Promise((resolve) => setTimeout(resolve, 80)); } throw new Error(`Timed out: ${expression}`); };
await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await send("Page.navigate", { url: `${origin}/?debug=1&perf=1` });
await waitFor(`Boolean(document.querySelector('[data-testid="scene-director"]'))`, 40_000);
await waitFor(`Boolean(document.documentElement.dataset.visualQuality)`);
assert.equal(await evaluate(`document.documentElement.dataset.visualQuality`), "LOW", "dense coarse mobile profile must start LOW");
for (const mode of ["LOW", "HIGH", "AUTO"]) {
  await evaluate(`window.dispatchEvent(new CustomEvent('soulbound:debug-visual-quality', { detail: { quality: '${mode}' } }))`);
  await waitFor(`document.documentElement.dataset.visualQuality === '${mode}'`);
}
await waitFor(`document.querySelector('[data-testid="performance-debug-panel"]')?.textContent?.includes('AUTO/')`);
const samples = [];
for (let cycle = 0; cycle < 4; cycle += 1) {
  for (const scene of ["S03", "S07", "S09", "FINAL", "S03"]) {
    await evaluate(`window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: '${scene}' } }))`);
    await waitFor(`document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === '${scene}'`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  await send("HeapProfiler.collectGarbage");
  const heap = await send("Runtime.getHeapUsage");
  samples.push({ cycle, used: heap.usedSize, dom: await evaluate(`({ canvases: document.querySelectorAll('canvas').length, videos: document.querySelectorAll('video').length, audios: document.querySelectorAll('audio').length })`) });
}
assert.ok(samples.every((sample) => sample.dom.canvases === 1), "jump cycles must retain one Canvas");
assert.ok(samples.every((sample) => sample.dom.videos <= 1), "obsolete scene videos must be released");
assert.ok(samples.at(-1).used <= samples[0].used * 1.35 + 2_000_000, "post-GC heap must plateau across jump cycles");
assert.deepEqual(errors, []);
console.log(JSON.stringify({ ok: true, qualityModes: ["LOW", "HIGH", "AUTO"], samples }, null, 2));
socket.close();
