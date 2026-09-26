import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const endpoint = process.env.SOULBOUND_CDP ?? "http://127.0.0.1:9225";
const origin = process.env.SOULBOUND_ORIGIN ?? "http://localhost:3000";
const artifactDirectory = path.resolve(".next", "phase16-film");
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

async function evaluate(expression, userGesture = false) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(label, expression, timeout = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(await snapshot())}`);
}

async function screenshot(filename) {
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await fs.writeFile(path.join(artifactDirectory, filename), Buffer.from(result.data, "base64"));
}

async function snapshot() {
  return evaluate(`(() => {
    const director = document.querySelector('[data-testid="scene-director"]');
    const final = document.querySelector('[data-testid="final-scene"]');
    return {
      scene: director?.getAttribute('data-scene-id'),
      phase: director?.getAttribute('data-scene-phase'),
      runId: director?.getAttribute('data-run-id'),
      bridge: document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-state'),
      mask: document.querySelector('[data-testid="transition-mask"]')?.getAttribute('data-transition-state'),
      answer: final?.getAttribute('data-answer-state'),
      beat: final?.getAttribute('data-scene-beat'),
      music: document.querySelector('[data-testid="audio-music-state"]')?.textContent?.trim() ?? '',
      musicGain: document.querySelector('[data-testid="audio-music-gain"]')?.textContent?.trim() ?? '',
      playingVideos: [...document.querySelectorAll('video')].filter((video) => !video.paused).length,
      canvases: document.querySelectorAll('canvas').length,
      body: getComputedStyle(document.body).backgroundColor,
      stored: localStorage.getItem('soulbound.answer.v1'),
      monitor: window.__phase16Monitor,
    };
  })()`);
}

async function clickUnique(selector) {
  const count = await evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
  assert.equal(count, 1, `Expected exactly one ${selector}`);
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`, true);
}

async function waitForScene(sceneId, timeout = 60_000) {
  await waitFor(`${sceneId} active`, `(() => { const director = document.querySelector('[data-testid="scene-director"]'); return director?.getAttribute('data-scene-id') === '${sceneId}' && director?.getAttribute('data-scene-phase') === 'active'; })()`, timeout);
}

async function continueOnce(sceneId, timeout = 60_000) {
  if (/^S(?:0[1-9]|10)$/.test(sceneId)) {
    await waitFor(`${sceneId} explicit Soul claim`, `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === '${sceneId}' && Boolean(document.querySelector('[data-testid="soul-claim-target"]'))`, timeout);
    await evaluate(`(() => { const target = document.querySelector('[data-testid="soul-claim-target"]'); target?.focus(); target?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true })); })()`, true);
  }
  await waitFor(`${sceneId} continue`, `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === '${sceneId}' && Boolean(document.querySelector('[data-testid="cinematic-continue"]'))`, timeout);
  await clickUnique('[data-testid="cinematic-continue"]');
}

async function installMonitor(branch) {
  await evaluate(`(() => {
    if (window.__phase16MonitorTimer) clearInterval(window.__phase16MonitorTimer);
    const startedAt = performance.now();
    window.__phase16Monitor = { branch: ${JSON.stringify(branch)}, startedAt, endedAt: null, entries: [], cues: [], emptyFrames: 0, whiteFrames: 0, maxCanvases: 0, maxVideos: 0, last: '' };
    window.__phase16MonitorTimer = setInterval(() => {
      const monitor = window.__phase16Monitor;
      const director = document.querySelector('[data-testid="scene-director"]');
      const scene = director?.getAttribute('data-scene-id') ?? '';
      const phase = director?.getAttribute('data-scene-phase') ?? '';
      const runId = director?.getAttribute('data-run-id') ?? '';
      const key = scene + ':' + phase + ':' + runId;
      if (key !== monitor.last) { monitor.entries.push({ scene, phase, runId, at: performance.now() - startedAt }); monitor.last = key; }
      const bridge = document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-state') ?? 'idle';
      const black = document.querySelector('[data-absolute-black]')?.getAttribute('data-absolute-black') === 'true';
      if (!director && bridge === 'idle' && !black) monitor.emptyFrames += 1;
      if (getComputedStyle(document.body).backgroundColor !== 'rgb(0, 0, 0)') monitor.whiteFrames += 1;
      monitor.maxCanvases = Math.max(monitor.maxCanvases, document.querySelectorAll('canvas').length);
      monitor.maxVideos = Math.max(monitor.maxVideos, [...document.querySelectorAll('video')].filter((video) => !video.paused).length);
    }, 16);
    return true;
  })()`);
}

async function cue(name) {
  await evaluate(`window.__phase16Monitor?.cues.push({ name: ${JSON.stringify(name)}, at: performance.now() - window.__phase16Monitor.startedAt })`);
}

function summarizeDurations(monitor) {
  const firstByScene = [];
  for (const entry of monitor.entries) {
    if (!entry.scene || firstByScene.some((item) => item.scene === entry.scene)) continue;
    firstByScene.push({ scene: entry.scene, at: entry.at });
  }
  return Object.fromEntries(firstByScene.map((item, index) => {
    const end = firstByScene[index + 1]?.at ?? monitor.endedAt;
    return [item.scene, Number(((end - item.at) / 1000).toFixed(3))];
  }));
}

async function startFresh(branch) {
  await send("Page.navigate", { url: `${origin}/?phase16Film=${branch.toLowerCase()}` });
  await waitFor("application shell", `Boolean(document.querySelector('[data-testid="scene-director"]'))`, 30_000);
  await evaluate(`localStorage.removeItem('soulbound.answer.v1'); sessionStorage.clear()`);
  await send("Page.reload", { ignoreCache: false });
  await waitFor("fresh film shell", `Boolean(document.querySelector('[data-testid="scene-director"]'))`, 30_000);
  await installMonitor(branch);
}

async function runFilm(branch) {
  await startFresh(branch);
  await waitForScene("PROLOGUE", 30_000);
  await waitFor("Open Soul", `(() => { const button = document.querySelector('[data-testid="open-soul"]'); return Boolean(button && !button.disabled && Number(getComputedStyle(button).opacity) > .45); })()`, 25_000);
  await cue("OPEN_SOUL");
  await clickUnique('[data-testid="open-soul"]');

  await waitForScene("S01", 15_000); await continueOnce("S01", 35_000);
  await waitForScene("S02", 15_000);
  await waitFor("special notification", `(() => { const button = document.querySelector('[data-testid="special-notification"]'); return Boolean(button && !button.disabled); })()`, 20_000);
  await cue("S02_SPECIAL"); await clickUnique('[data-testid="special-notification"]'); await continueOnce("S02", 25_000);
  await waitForScene("S03", 15_000); await continueOnce("S03", 45_000);
  await waitForScene("S04", 15_000); await continueOnce("S04", 30_000);
  await waitForScene("S05", 15_000); await cue("S05_LIGHT"); await clickUnique('[data-testid="morning-light-target"]'); await continueOnce("S05", 35_000);
  await waitForScene("S06", 15_000); await cue("S06_HEART"); await clickUnique('[data-testid="heart-reaction-hotspot"]'); await continueOnce("S06", 30_000);
  await waitForScene("S07", 15_000); await continueOnce("S07", 45_000);
  await waitForScene("S08", 15_000); await continueOnce("S08", 35_000);
  await waitForScene("S09", 15_000);
  await waitFor("pain hold", `(() => { const button = document.querySelector('[aria-label="Удерживай, чтобы принять часть боли"]'); return Boolean(button && !button.disabled); })()`, 35_000);
  await cue("S09_HOLD_START");
  await evaluate(`(() => { const button = document.querySelector('[aria-label="Удерживай, чтобы принять часть боли"]'); button?.focus(); button?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })); })()`, true);
  await sleep(2_750);
  await evaluate(`document.querySelector('[aria-label="Удерживай, чтобы принять часть боли"]')?.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true, cancelable: true }))`, true);
  await continueOnce("S09", 30_000);
  await waitForScene("S10", 15_000); await continueOnce("S10", 55_000);
  await waitForScene("PRE_FINAL", 15_000); await continueOnce("PRE_FINAL", 35_000);
  await waitForScene("SOULS_RELEASE", 15_000);
  await waitForScene("REQUIEM", 20_000);
  await waitForScene("SILENCE", 35_000); await cue("DIGITAL_SILENCE");
  await waitForScene("FINAL", 35_000);
  await waitFor("answer controls", `document.querySelectorAll('[data-testid="final-scene"] fieldset button').length === 2`, 40_000);
  await cue("ANSWER_CONTROLS");
  const selector = `[data-testid="final-scene"] fieldset button[data-answer="${branch}"]`;
  const answerCount = await evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
  if (answerCount === 1) await clickUnique(selector);
  else await evaluate(`document.querySelectorAll('[data-testid="final-scene"] fieldset button')[${branch === "YES" ? 0 : 1}]?.click()`, true);
  await waitFor(`${branch} stable`, `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-answer-state') === '${branch}'`, branch === "YES" ? 25_000 : 10_000);
  await evaluate(`window.__phase16Monitor.endedAt = performance.now() - window.__phase16Monitor.startedAt`);
  const settled = await snapshot();
  assert.equal(settled.scene, "FINAL");
  assert.equal(settled.phase, "active");
  assert.equal(settled.answer, branch);
  assert.equal(settled.bridge, "idle");
  assert.equal(settled.mask, "idle");
  assert.equal(settled.canvases, 1);
  assert.equal(settled.body, "rgb(0, 0, 0)");
  assert.equal(settled.monitor.emptyFrames, 0);
  assert.equal(settled.monitor.whiteFrames, 0);
  assert.equal(settled.monitor.maxCanvases, 1);
  assert.match(settled.stored ?? "", new RegExp(`"result":"${branch}"`));
  await screenshot(`full-film-${branch.toLowerCase()}-stable.png`);
  return {
    branch,
    totalSeconds: Number((settled.monitor.endedAt / 1000).toFixed(3)),
    sceneSeconds: summarizeDurations(settled.monitor),
    cues: settled.monitor.cues.map((item) => ({ ...item, at: Number((item.at / 1000).toFixed(3)) })),
    final: settled,
  };
}

await fs.mkdir(artifactDirectory, { recursive: true });
await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
const yes = await runFilm("YES");
const think = await runFilm("THINK");
const seriousErrors = browserErrors.filter((message) => !message.includes("favicon.ico") && !message.includes("/_next/hmr") && !message.includes("Failed to load resource: the server responded with a status of 404"));
assert.deepEqual(seriousErrors, []);
const report = { ok: true, yes, think, browserErrors: seriousErrors, artifacts: artifactDirectory };
await fs.writeFile(path.join(artifactDirectory, "results.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
socket.close();
