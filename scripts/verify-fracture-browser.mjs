import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const endpoint = process.env.SOULBOUND_CDP ?? "http://127.0.0.1:9226";
const origin = process.env.SOULBOUND_ORIGIN ?? "http://localhost:3000";
const repetitions = Number(process.env.SOULBOUND_FRACTURE_REPETITIONS ?? 10);
const artifactDirectory = path.resolve(".next", "fracture-browser");
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const configuredViewports = [
  { width: 1920, height: 1080, mobile: false, repetitions },
  { width: 2560, height: 1440, mobile: false, repetitions },
  { width: 390, height: 844, mobile: true, repetitions: Math.min(3, repetitions) },
];
const viewportFilter = process.env.SOULBOUND_FRACTURE_VIEWPORT;
const viewports = viewportFilter
  ? configuredViewports.filter((viewport) => `${viewport.width}x${viewport.height}` === viewportFilter)
  : configuredViewports;
if (!viewports.length) throw new Error("Fracture viewport filter did not match a configured viewport.");

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
  if (message.method === "Log.entryAdded" && message.params.entry.level === "error") browserErrors.push(message.params.entry.text);
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

async function waitFor(label, expression, timeout = 30_000, interval = 20) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await sleep(interval);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function screenshot(filename) {
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await fs.writeFile(path.join(artifactDirectory, filename), Buffer.from(result.data, "base64"));
}

async function selectAndRun() {
  const selected = await evaluate(`(() => {
    const select = document.querySelector('[data-testid="transition-lab-pair"]');
    if (!(select instanceof HTMLSelectElement)) return false;
    select.value = 'S07_S08';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  assert.equal(selected, true);
  await sleep(35);
  const clicked = await evaluate(`(() => {
    const button = document.querySelector('[data-testid="transition-lab-run"]');
    if (!(button instanceof HTMLButtonElement)) return false;
    button.click();
    return true;
  })()`);
  assert.equal(clicked, true);
}

await fs.mkdir(artifactDirectory, { recursive: true });
await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");

const report = [];
for (const viewport of viewports) {
  await send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile });
  await send("Page.navigate", { url: `${origin}/?debug=1&transitionLab=1` });
  await waitFor("Transition Lab", `Boolean(document.querySelector('[data-testid="transition-lab"]'))`);
  await waitFor("active director", `document.querySelector('[data-testid="scene-director"]')?.dataset.scenePhase === 'active'`);
  await evaluate(`window.dispatchEvent(new CustomEvent('soulbound:debug-visual-quality', { detail: { quality: 'HIGH' } }))`);

  for (let repetition = 1; repetition <= viewport.repetitions; repetition += 1) {
    await selectAndRun();
    await waitFor("infinity ready", `document.querySelector('[data-testid="s07-scene"]')?.dataset.transitionLabState === 'RATING_INFINITY_READY'`);
    const target = viewport.repetitions === 1
      ? { seed: "7073", label: "final" }
      : repetition === 1
        ? { seed: "7071", label: "micro" }
        : repetition === 2
          ? { seed: "7072", label: "second" }
          : { seed: "7073", label: "final" };
    await waitFor(`${target.label} fracture`, `document.querySelector('[data-cinematic-fracture-host]')?.dataset.fractureSeed === '${target.seed}' && document.querySelector('[data-cinematic-fracture-host]')?.dataset.fractureActive === 'true'`, 8_000, 8);
    const damaged = await evaluate(`(() => ({
      oldMapImages: [...document.images].filter((image) => image.src.includes('GLOBAL-06')).length,
      slices: document.querySelectorAll('.cinematic-fracture-slice').length,
      blackTears: document.querySelectorAll('.cinematic-fracture-black-tear').length,
      whiteLayers: [...document.querySelectorAll('.cinematic-fracture-slice, .cinematic-fracture-black-tear')].filter((node) => getComputedStyle(node).backgroundColor === 'rgb(255, 255, 255)').length,
      stack: document.elementsFromPoint(4, innerHeight / 2).slice(0, 8).map((node) => { const style = getComputedStyle(node); return { tag: node.tagName, className: String(node.className), opacity: style.opacity, background: style.backgroundImage, backgroundColor: style.backgroundColor, filter: style.filter, top: style.top, height: style.height }; }),
    }))()`);
    assert.equal(damaged.oldMapImages, 0);
    assert.equal(damaged.whiteLayers, 0);
    assert.equal(damaged.slices > 0, true);
    if (repetition <= 3) await screenshot(`${viewport.width}x${viewport.height}-${target.label}.png`);
    await waitFor("S08 active", `document.querySelector('[data-testid="scene-director"]')?.dataset.sceneId === 'S08' && document.querySelector('[data-testid="scene-director"]')?.dataset.scenePhase === 'active'`, 18_000);
    await waitFor("fracture cleanup", `document.querySelector('[data-cinematic-fracture-host]')?.dataset.fractureActive !== 'true'`, 3_000);
    const settled = await evaluate(`(() => ({
      scene: document.querySelector('[data-testid="scene-director"]')?.dataset.sceneId,
      oldMapImages: [...document.images].filter((image) => image.src.includes('GLOBAL-06')).length,
      fractureNodes: document.querySelectorAll('.cinematic-fracture-slice, .cinematic-fracture-black-tear, .cinematic-fracture-echo').length,
      story: document.querySelector('[data-testid="s08-scene"]')?.dataset.screenshotStage,
    }))()`);
    assert.equal(settled.scene, "S08");
    assert.equal(settled.oldMapImages, 0);
    assert.equal(settled.fractureNodes, 0);
    if (repetition === 1) await screenshot(`${viewport.width}x${viewport.height}-stable.png`);
    report.push({ viewport: `${viewport.width}x${viewport.height}`, repetition, target: target.label, damaged, settled });
  }
}

await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setEmulatedMedia", {
  media: "screen",
  features: [{ name: "prefers-reduced-motion", value: "reduce" }],
});
await send("Page.navigate", { url: `${origin}/?debug=1&transitionLab=1` });
await waitFor("reduced-motion Transition Lab", `Boolean(document.querySelector('[data-testid="transition-lab"]'))`);
await waitFor("reduced-motion active director", `document.querySelector('[data-testid="scene-director"]')?.dataset.scenePhase === 'active'`);
await selectAndRun();
await waitFor("reduced-motion final fracture", `document.querySelector('[data-cinematic-fracture-host]')?.dataset.fractureSeed === '7073' && document.querySelector('[data-cinematic-fracture-host]')?.dataset.fractureActive === 'true'`, 8_000, 8);
const reducedTransition = await evaluate(`(() => ({
  slices: document.querySelectorAll('.cinematic-fracture-slice').length,
  echoes: document.querySelectorAll('.cinematic-fracture-echo').length,
  filters: [...document.querySelectorAll('.cinematic-fracture-slice > *')].map((node) => getComputedStyle(node).filter),
}))()`);
assert.equal(reducedTransition.slices, 1);
assert.equal(reducedTransition.echoes, 0);
assert.equal(reducedTransition.filters.some((filter) => filter.includes("drop-shadow")), false);
await waitFor("reduced-motion S08 active", `document.querySelector('[data-testid="scene-director"]')?.dataset.sceneId === 'S08' && document.querySelector('[data-testid="scene-director"]')?.dataset.scenePhase === 'active'`, 18_000);

await send("Page.navigate", { url: `${origin}/?debug=1&soulSandbox=1&requiemSync=1` });
await waitFor("reduced-motion Soul sandbox", `Boolean(document.querySelector('[data-testid="soul-collection-sandbox"]'))`, 25_000);
await evaluate(`(() => {
  [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'SEED 10')?.click();
})()`);
await waitFor("reduced-motion ten Souls", `document.querySelector('[data-testid="collection-count"]')?.textContent?.trim() === '10 / 10'`, 8_000);
await evaluate(`(() => {
  const sandbox = document.querySelector('[data-testid="soul-collection-sandbox"]');
  if (sandbox instanceof HTMLElement) sandbox.style.display = 'none';
  const director = document.querySelector('[data-testid="scene-director"]');
  if (director instanceof HTMLElement) { director.style.opacity = '1'; director.style.pointerEvents = 'auto'; }
  window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: 'SOULS_RELEASE' } }));
})()`);
await waitFor("reduced-motion Requiem", `document.querySelector('[data-testid="scene-director"]')?.dataset.sceneId === 'REQUIEM'`, 15_000);
await waitFor("reduced-motion primary fracture", `(() => { const scene = document.querySelector('[data-testid="requiem-scene"]'); return scene?.dataset.fractureCue === 'primaryImpact' && scene.querySelector('[data-cinematic-fracture-host]')?.dataset.fractureActive === 'true'; })()`, 12_000, 8);
const reducedRequiem = await evaluate(`(() => ({
  cue: document.querySelector('[data-testid="requiem-scene"]')?.dataset.fractureCue,
  slices: document.querySelector('[data-testid="requiem-scene"]')?.dataset.fractureSlices,
  duration: document.querySelector('[data-testid="requiem-scene"]')?.dataset.fractureDuration,
  domSlices: document.querySelectorAll('[data-testid="requiem-scene"] .cinematic-fracture-slice').length,
}))()`);
assert.equal(reducedRequiem.cue, "primaryImpact");
assert.equal(reducedRequiem.slices, "1");
assert.equal(reducedRequiem.duration, "140");
assert.equal(reducedRequiem.domSlices, 1);
await sleep(2_200);
assert.equal(await evaluate(`document.querySelector('[data-testid="requiem-scene"]')?.dataset.fractureCue`), "primaryImpact");

await send("Emulation.setEmulatedMedia", { media: "screen", features: [] });
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: `${origin}/?debug=1&fractureLab=1` });
await waitFor("Fracture Lab", `Boolean(document.querySelector('[data-testid="fracture-lab"]'))`);
const labTriggered = await evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find((candidate) => candidate.textContent?.trim() === 'Trigger HERO');
  if (!(button instanceof HTMLButtonElement)) return false;
  button.click();
  return true;
})()`);
assert.equal(labTriggered, true);
await waitFor("Fracture Lab hero", `document.querySelector('[data-cinematic-fracture-host]')?.dataset.fractureActive === 'true'`, 2_000, 8);
await waitFor("Fracture Lab metrics", `document.querySelector('[data-testid="fracture-lab"] aside dl')?.textContent?.includes('260 ms') === true`, 2_000, 8);
const labMetrics = await evaluate(`document.querySelector('[data-testid="fracture-lab"] aside dl')?.textContent ?? ''`);
assert.match(labMetrics, /S07_TO_S08/);
assert.match(labMetrics, /render targets0/);
assert.match(labMetrics, /shader warmedYES/);
await screenshot("fracture-lab-hero.png");

const seriousErrors = browserErrors.filter((message) =>
  !message.includes("favicon.ico") &&
  !message.includes("/_next/hmr") &&
  !message.includes("Failed to load resource: the server responded with a status of 404"),
);
assert.deepEqual(seriousErrors, []);
console.log(JSON.stringify({ ok: true, report, reducedMotion: { transition: reducedTransition, requiem: reducedRequiem }, labMetrics, browserErrors: seriousErrors, artifacts: artifactDirectory }, null, 2));
socket.close();
