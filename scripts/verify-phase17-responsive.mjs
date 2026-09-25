import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const endpoint = process.env.SOULBOUND_CDP ?? "http://127.0.0.1:9226";
const origin = process.env.SOULBOUND_ORIGIN ?? "http://localhost:3000";
const quality = process.env.SOULBOUND_VISUAL_QUALITY === "MEDIUM" ? "MEDIUM" : "HIGH";
const artifactDirectory = path.resolve(".next", `phase17-responsive-${quality.toLowerCase()}`);
const allViewports = [
  { width: 1600, height: 900 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 },
];
const allScenes = [
  { id: "S03", delay: 22_200, label: "depth" },
  { id: "S07", delay: 16_400, label: "portrait-rating" },
  { id: "S08", delay: 10_300, label: "queen" },
  { id: "S09", delay: 17_100, label: "pain" },
  { id: "FINAL", delay: 18_500, label: "heart-question" },
];
const viewportFilter = process.env.SOULBOUND_RESPONSIVE_VIEWPORT;
const sceneFilter = process.env.SOULBOUND_RESPONSIVE_SCENE;
const viewports = viewportFilter
  ? [...allViewports, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }]
    .filter(({ width, height }) => `${width}x${height}` === viewportFilter)
  : allViewports;
const scenes = sceneFilter ? allScenes.filter(({ id }) => id === sceneFilter) : allScenes;
if (!viewports.length || !scenes.length) throw new Error("Responsive QA filter did not match a configured viewport or scene.");
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
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
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

async function waitFor(label, expression, timeout = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await sleep(80);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function screenshot(filename) {
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await fs.writeFile(path.join(artifactDirectory, filename), Buffer.from(result.data, "base64"));
}

await fs.mkdir(artifactDirectory, { recursive: true });
await send("Page.enable");
await send("Runtime.enable");

const report = [];
for (const viewport of viewports) {
  await send("Emulation.setDeviceMetricsOverride", { ...viewport, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  await send("Page.navigate", { url: `${origin}/?debug=1&phase17Responsive=1` });
  await waitFor("development SceneDirector", `Boolean(document.querySelector('[data-testid="scene-director"]'))`);
  await evaluate(`localStorage.removeItem('soulbound.answer.v1')`);
  await waitFor("development visual quality hook", `Boolean(document.documentElement.dataset.visualQuality)`);
  await evaluate(`(() => {
    const style = document.createElement('style');
    style.id = 'phase17-hide-debug-ui';
    style.textContent = 'body aside { display: none !important; }';
    document.head.append(style);
    window.dispatchEvent(new CustomEvent('soulbound:debug-visual-quality', { detail: { quality: '${quality}' } }));
  })()`);
  await waitFor(`${quality} visual quality`, `document.documentElement.dataset.visualQuality === '${quality}'`);

  for (const scene of scenes) {
    await evaluate(`window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: '${scene.id}' } }))`);
    await waitFor(`${scene.id} active`, `(() => { const director = document.querySelector('[data-testid="scene-director"]'); return director?.getAttribute('data-scene-id') === '${scene.id}' && director?.getAttribute('data-scene-phase') === 'active'; })()`, 35_000);
    await sleep(scene.delay);
    const audit = await evaluate(`(() => {
      const director = document.querySelector('[data-testid="scene-director"]');
      const root = director?.querySelector('section') ?? director;
      const visible = root ? [...root.querySelectorAll('h1,h2,p,button,output,time')].filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > .025 && rect.width > 1 && rect.height > 1;
      }) : [];
      const overflows = visible.map((element) => {
        const rect = element.getBoundingClientRect();
        return { tag: element.tagName, text: (element.textContent || '').trim().slice(0, 80), x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom };
      }).filter((rect) => rect.x < -1 || rect.y < -1 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1);
      return {
        scene: director?.getAttribute('data-scene-id'),
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        quality: document.documentElement.dataset.visualQuality,
        documentOverflow: { x: document.documentElement.scrollWidth - innerWidth, y: document.documentElement.scrollHeight - innerHeight },
        overflows,
        canvases: document.querySelectorAll('canvas').length,
      };
    })()`);
    assert.deepEqual(audit.viewport, { ...viewport, dpr: 1 });
    assert.equal(audit.quality, quality);
    assert.deepEqual(audit.documentOverflow, { x: 0, y: 0 });
    assert.deepEqual(audit.overflows, []);
    assert.equal(audit.canvases, 1);
    report.push({ ...audit, label: scene.label });
    await screenshot(`${viewport.width}x${viewport.height}-${scene.id.toLowerCase()}-${scene.label}.png`);
  }
}

await fs.writeFile(path.join(artifactDirectory, "audit.json"), `${JSON.stringify({ ok: true, quality, report }, null, 2)}\n`);
socket.close();
console.log(JSON.stringify({ ok: true, quality, frames: report.length, artifacts: artifactDirectory }, null, 2));
