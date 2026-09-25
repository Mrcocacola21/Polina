import { writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const endpoint = process.env.SOULBOUND_CDP ?? "http://127.0.0.1:9230";
const navigate = process.env.SOULBOUND_NAVIGATE === "1";
const origin = process.env.SOULBOUND_ORIGIN ?? "http://localhost:3000";
const output = path.resolve(process.env.SOULBOUND_PERF_OUTPUT ?? ".next/phase19-runtime.json");
const tabs = await fetch(`${endpoint}/json/list`).then((response) => response.json());
const page = tabs.find((tab) => tab.type === "page" && tab.url === "about:blank") ?? tabs.find((tab) => tab.type === "page");
if (!page?.webSocketDebuggerUrl) throw new Error("No Chromium page target is available.");
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
let id = 0;
const pending = new Map();
const network = { requests: 0, bytes: 0 };
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Network.requestWillBeSent") network.requests += 1;
  if (message.method === "Network.loadingFinished") network.bytes += message.params.encodedDataLength ?? 0;
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(message.error.message));
  else waiter.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const callId = ++id; pending.set(callId, { resolve, reject }); socket.send(JSON.stringify({ id: callId, method, params })); });
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
await send("Runtime.enable");
await send("Performance.enable");
await send("Network.enable");
let openSoulUsableMs = null;
if (navigate) {
  await send("Network.setCacheDisabled", { cacheDisabled: process.env.SOULBOUND_DISABLE_CACHE !== "0" });
  const started = Date.now();
  await send("Page.navigate", { url: origin });
  while (Date.now() - started < 60_000) {
    const ready = await evaluate(`(() => { const button = document.querySelector('[data-testid="open-soul"]'); return Boolean(button && !button.disabled && Number(getComputedStyle(button).opacity) > .45); })()`);
    if (ready) { openSoulUsableMs = Date.now() - started; break; }
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  if (openSoulUsableMs === null) throw new Error("Open Soul did not become usable within 60 seconds.");
  await new Promise((resolve) => setTimeout(resolve, 500));
}
await send("HeapProfiler.collectGarbage");
const [heap, metrics, pageMetrics] = await Promise.all([
  send("Runtime.getHeapUsage"),
  send("Performance.getMetrics"),
  evaluate(`(() => {
    const entries = performance.getEntriesByType('resource');
    const byType = {};
    for (const entry of entries) {
      const url = new URL(entry.name);
      const extension = url.pathname.split('.').pop()?.toLowerCase() ?? 'other';
      const key = ['png','jpg','jpeg','webp'].includes(extension) ? 'image' : ['wav','mp3','webm'].includes(extension) ? 'audio' : extension === 'mp4' ? 'video' : ['js'].includes(extension) ? 'script' : extension === 'css' ? 'style' : 'other';
      byType[key] ??= { requests: 0, transfer: 0, encoded: 0 };
      byType[key].requests += 1; byType[key].transfer += entry.transferSize || 0; byType[key].encoded += entry.encodedBodySize || 0;
    }
    const canvas = document.querySelector('canvas');
    const rect = canvas?.getBoundingClientRect();
    return {
      scene: document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id'),
      resources: entries.length,
      uniqueResources: new Set(entries.map((entry) => entry.name)).size,
      transfer: entries.reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
      encoded: entries.reduce((sum, entry) => sum + (entry.encodedBodySize || 0), 0),
      byType,
      dom: { canvases: document.querySelectorAll('canvas').length, videos: document.querySelectorAll('video').length, audio: document.querySelectorAll('audio').length },
      canvas: canvas && rect ? { css: [rect.width, rect.height], backing: [canvas.width, canvas.height] } : null,
    };
  })()`),
]);
const metricMap = Object.fromEntries(metrics.metrics.map((metric) => [metric.name, metric.value]));
const report = { openSoulUsableMs, network, page: pageMetrics, heap, metrics: { JSHeapUsedSize: metricMap.JSHeapUsedSize, JSHeapTotalSize: metricMap.JSHeapTotalSize, Nodes: metricMap.Nodes, JSEventListeners: metricMap.JSEventListeners, LayoutCount: metricMap.LayoutCount } };
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
socket.close();
