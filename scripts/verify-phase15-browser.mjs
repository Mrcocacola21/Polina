import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const endpoint = process.env.SOULBOUND_CDP ?? "http://127.0.0.1:9225";
const appUrl = process.env.SOULBOUND_URL ?? "http://localhost:3000/?debug=1&transitionLab=1";
const repetitions = Number(process.env.SOULBOUND_TRANSITION_REPETITIONS ?? 3);
const artifactDirectory = path.resolve(".next", "phase15-browser");
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const pairs = [
  ["PROLOGUE_S01", "PROLOGUE", "S01"],
  ["S01_S02", "S01", "S02"],
  ["S02_S03", "S02", "S03"],
  ["S03_S04", "S03", "S04"],
  ["S04_S05", "S04", "S05"],
  ["S05_S06", "S05", "S06"],
  ["S06_S07", "S06", "S07"],
  ["S07_S08", "S07", "S08"],
  ["S08_S09", "S08", "S09"],
  ["S09_S10", "S09", "S10"],
  ["S10_PRE_FINAL", "S10", "PRE_FINAL"],
  ["PRE_FINAL_SOULS_RELEASE", "PRE_FINAL", "SOULS_RELEASE"],
  ["SOULS_RELEASE_REQUIEM", "SOULS_RELEASE", "REQUIEM"],
  ["REQUIEM_SILENCE", "REQUIEM", "SILENCE"],
  ["SILENCE_FINAL", "SILENCE", "FINAL"],
];

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

async function waitFor(label, expression, timeout = 45_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await sleep(80);
  }
  console.error(label, await snapshot(), browserErrors);
  throw new Error(`Timed out waiting for ${label}.`);
}

async function screenshot(filename) {
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await fs.writeFile(path.join(artifactDirectory, filename), Buffer.from(result.data, "base64"));
}

async function snapshot() {
  return evaluate(`(() => {
    const director = document.querySelector('[data-testid="scene-director"]');
    const bridge = document.querySelector('[data-testid="transition-bridge"]');
    const lab = document.querySelector('[data-testid="transition-lab"]');
    const audioText = (id) => document.querySelector('[data-testid="' + id + '"]')?.textContent?.trim() ?? '';
    return {
      scene: director?.getAttribute('data-scene-id'),
      phase: director?.getAttribute('data-scene-phase'),
      runId: Number(director?.getAttribute('data-run-id') ?? 0),
      labRun: director?.getAttribute('data-transition-lab-run'),
      labStarted: director?.getAttribute('data-transition-lab-started'),
      bridgeId: bridge?.getAttribute('data-transition-id'),
      bridgeState: bridge?.getAttribute('data-transition-state'),
      outgoingRunId: Number(bridge?.getAttribute('data-outgoing-run-id') || 0),
      incomingRunId: Number(bridge?.getAttribute('data-incoming-run-id') || 0),
      visualMask: document.querySelector('[data-testid="transition-mask"]')?.getAttribute('data-transition-state') ?? 'idle',
      cursor: document.querySelector('[data-cursor-mode]')?.getAttribute('data-cursor-mode'),
      hud: document.querySelector('[data-testid="soul-hud"]')?.getAttribute('data-hud-mode'),
      body: getComputedStyle(document.body).backgroundColor,
      canvases: document.querySelectorAll('canvas').length,
      videos: [...document.querySelectorAll('video')].filter((video) => !video.paused).length,
      mediaLoading: document.querySelectorAll('[data-media-status="loading"]').length,
      particles: audioText('visual-particle-count') || document.querySelector('[data-testid="transition-lab"]')?.textContent?.match(/particles\s+(\d+)/i)?.[1] || '',
      music: audioText('audio-music-state'),
      activeAudio: audioText('audio-active-counts'),
      lab: Boolean(lab),
    };
  })()`);
}

async function selectAndRun(id) {
  await evaluate(`(() => {
    const select = document.querySelector('[data-testid="transition-lab-pair"]');
    if (!(select instanceof HTMLSelectElement)) return false;
    select.value = ${JSON.stringify(id)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(30);
  const clicked = await evaluate(`(() => { const button = document.querySelector('[data-testid="transition-lab-run"]'); if (!(button instanceof HTMLButtonElement)) return false; button.click(); return true; })()`);
  assert.equal(clicked, true);
  await waitFor(`${id} lab arm`, `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-transition-lab-run') === '${id}'`, 5_000);
}

await fs.mkdir(artifactDirectory, { recursive: true });
await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: appUrl });
await waitFor("Transition Lab", `Boolean(document.querySelector('[data-testid="transition-lab"]'))`, 30_000);
await waitFor("hydrated SceneDirector", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-phase') === 'active'`, 30_000);
await sleep(1_200);
await evaluate(`document.querySelector('[data-testid="audio-unlock"]')?.click()`);

const results = [];
for (const [id, from, to] of pairs) {
  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    await selectAndRun(id);
    const instantaneous = id === "REQUIEM_SILENCE" || id === "SILENCE_FINAL";
    if (id === "REQUIEM_SILENCE") {
      await waitFor(`${id} source ready`, `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'REQUIEM' && document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-phase') === 'active'`, 30_000);
    } else if (id === "SILENCE_FINAL") {
      await waitFor(`${id} source ready`, `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'SILENCE' && document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-phase') === 'active'`, 8_000);
    } else {
      await waitFor(`${id} outgoing`, `document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-id') === '${id}' && document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-state') === 'outgoing'`, 30_000);
      const outgoing = await snapshot();
      assert.equal(outgoing.outgoingRunId > 0, true);
    }
    if (repetition === 1) {
      await screenshot(`${id.toLowerCase()}-before.png`);
      await sleep(instantaneous ? 20 : 380);
      await screenshot(`${id.toLowerCase()}-midpoint.png`);
    }
    await waitFor(`${id} incoming active`, `(() => { const director = document.querySelector('[data-testid="scene-director"]'); return director?.getAttribute('data-scene-id') === '${to}' && director?.getAttribute('data-scene-phase') === 'active'; })()`, id === "REQUIEM_SILENCE" ? 55_000 : id === "SILENCE_FINAL" ? 30_000 : 20_000);
    await waitFor(`${id} bridge cleanup`, `document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-state') === 'idle'`, 6_000);
    const settled = await snapshot();
    assert.equal(settled.scene, to);
    assert.equal(settled.phase, "active");
    assert.equal(settled.bridgeState, "idle");
    assert.equal(settled.visualMask, "idle");
    assert.equal(settled.body, "rgb(0, 0, 0)");
    assert.equal(settled.canvases, 1);
    if (settled.music) assert.doesNotMatch(settled.music, /decks [2-9]/);
    if (repetition === 1) await screenshot(`${id.toLowerCase()}-stable.png`);
    results.push({ id, repetition, from, to, settled });
  }
}

for (const id of ["PROLOGUE_S01", "S03_S04", "S04_S05", "S07_S08", "S08_S09", "PRE_FINAL_SOULS_RELEASE"]) {
  await selectAndRun(id);
  await waitFor(`${id} restart window`, `document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-id') === '${id}' && document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-state') === 'outgoing'`, 30_000);
  const before = await snapshot();
  await evaluate(`window.dispatchEvent(new Event('soulbound:debug-restart-scene'))`);
  await waitFor(`${id} restart cleanup`, `document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-state') === 'idle' && document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-run-id') !== '${before.runId}'`, 8_000);
  const restarted = await snapshot();
  assert.equal(restarted.bridgeState, "idle");
  assert.equal(restarted.visualMask, "idle");
}

await selectAndRun("SILENCE_FINAL");
await waitFor("SILENCE_FINAL restart boundary", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'FINAL'`, 30_000);
const finalEntering = await snapshot();
await evaluate(`window.dispatchEvent(new Event('soulbound:debug-restart-scene'))`);
await waitFor("SILENCE_FINAL restart cleanup", `(() => { const director = document.querySelector('[data-testid="scene-director"]'); return director?.getAttribute('data-scene-id') === 'FINAL' && Number(director?.getAttribute('data-run-id')) !== ${finalEntering.runId} && document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-state') === 'idle'; })()`, 8_000);
const restartedFinal = await snapshot();
assert.equal(restartedFinal.bridgeState, "idle");
assert.equal(restartedFinal.visualMask, "idle");

for (const [id, , to] of [["S04_S05", "S04", "S05"], ["S06_S07", "S06", "S07"], ["S03_S04", "S03", "S04"]]) {
  await selectAndRun(id);
  await waitFor(`${id} debug jump window`, `document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-state') === 'outgoing'`, 30_000);
  await evaluate(`window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: '${to}' } }))`);
  await waitFor(`${id} debug jump cleanup`, `document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-state') === 'idle'`, 8_000);
}

await selectAndRun("REQUIEM_SILENCE");
await waitFor("hard-cut jump source", `(() => { const director = document.querySelector('[data-testid="scene-director"]'); return director?.getAttribute('data-scene-id') === 'REQUIEM' && director?.getAttribute('data-scene-phase') === 'active'; })()`, 30_000);
await evaluate(`window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: 'SILENCE' } }))`);
await waitFor("hard-cut jump cleanup", `(() => { const director = document.querySelector('[data-testid="scene-director"]'); return director?.getAttribute('data-scene-id') === 'SILENCE' && document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-state') === 'idle'; })()`, 8_000);

await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
await selectAndRun("S08_S09");
await waitFor("reduced-motion incoming", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'S09' && document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-phase') === 'active'`, 20_000);
await waitFor("reduced-motion bridge cleanup", `document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-state') === 'idle'`, 4_000);

const seriousErrors = browserErrors.filter((message) =>
  !message.includes("favicon.ico") &&
  !message.includes("/_next/hmr") &&
  !message.includes("Failed to load resource: the server responded with a status of 404"),
);
assert.deepEqual(seriousErrors, []);
console.log(JSON.stringify({ ok: true, repetitions, transitions: results.length, results, browserErrors: seriousErrors, artifacts: artifactDirectory }, null, 2));
socket.close();
