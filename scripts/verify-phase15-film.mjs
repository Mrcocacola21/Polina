import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const endpoint = process.env.SOULBOUND_CDP ?? "http://127.0.0.1:9225";
const origin = process.env.SOULBOUND_ORIGIN ?? "http://localhost:3000";
const artifactDirectory = path.resolve(".next", "phase15-film");
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

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(label, expression, timeout = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(await filmSnapshot())}`);
}

async function screenshot(filename) {
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await fs.writeFile(path.join(artifactDirectory, filename), Buffer.from(result.data, "base64"));
}

async function filmSnapshot() {
  return evaluate(`(() => {
    const director = document.querySelector('[data-testid="scene-director"]');
    const final = document.querySelector('[data-testid="final-scene"]');
    return {
      scene: director?.getAttribute('data-scene-id'),
      phase: director?.getAttribute('data-scene-phase'),
      runId: director?.getAttribute('data-run-id'),
      bridge: document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-state'),
      mask: document.querySelector('[data-testid="transition-mask"]')?.getAttribute('data-transition-state'),
      cursor: document.querySelector('[data-cursor-mode]')?.getAttribute('data-cursor-mode'),
      hud: document.querySelector('[data-testid="soul-hud"]')?.getAttribute('data-hud-mode'),
      souls: document.querySelector('[data-testid="soul-count"]')?.textContent?.trim(),
      answer: final?.getAttribute('data-answer-state'),
      beat: final?.getAttribute('data-scene-beat'),
      mediaLoading: document.querySelectorAll('[data-media-status="loading"]').length,
      playingVideos: [...document.querySelectorAll('video')].filter((video) => !video.paused).length,
      canvases: document.querySelectorAll('canvas').length,
      body: getComputedStyle(document.body).backgroundColor,
      stored: localStorage.getItem('soulbound.answer.v1'),
      monitor: window.__phase15Monitor,
    };
  })()`);
}

async function clickUnique(selector) {
  const count = await evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
  assert.equal(count, 1, `Expected exactly one ${selector}`);
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
}

async function waitForScene(sceneId, timeout = 60_000) {
  await waitFor(`${sceneId} active`, `(() => { const director = document.querySelector('[data-testid="scene-director"]'); return director?.getAttribute('data-scene-id') === '${sceneId}' && director?.getAttribute('data-scene-phase') === 'active'; })()`, timeout);
}

async function continueOnce(sceneId, timeout = 60_000) {
  await waitFor(`${sceneId} continue`, `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === '${sceneId}' && Boolean(document.querySelector('[data-testid="cinematic-continue"]'))`, timeout);
  await evaluate(`(() => { const button = document.querySelector('[data-testid="cinematic-continue"]'); button?.click(); button?.click(); })()`);
}

async function installMonitor() {
  await evaluate(`(() => {
    if (window.__phase15MonitorTimer) clearInterval(window.__phase15MonitorTimer);
    window.__phase15Monitor = { emptyFrames: 0, whiteFrames: 0, maxCanvases: 0, maxVideos: 0, boundaries: [], last: '' };
    window.__phase15MonitorTimer = setInterval(() => {
      const monitor = window.__phase15Monitor;
      const director = document.querySelector('[data-testid="scene-director"]');
      const scene = director?.getAttribute('data-scene-id') ?? '';
      const phase = director?.getAttribute('data-scene-phase') ?? '';
      const key = scene + ':' + phase + ':' + (director?.getAttribute('data-run-id') ?? '');
      if (key !== monitor.last) { monitor.boundaries.push(key); monitor.last = key; }
      const bridge = document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-state') ?? 'idle';
      const black = document.querySelector('[data-absolute-black]')?.getAttribute('data-absolute-black') === 'true';
      if (!director && bridge === 'idle' && !black) monitor.emptyFrames += 1;
      const background = getComputedStyle(document.body).backgroundColor;
      if (background !== 'rgb(0, 0, 0)') monitor.whiteFrames += 1;
      monitor.maxCanvases = Math.max(monitor.maxCanvases, document.querySelectorAll('canvas').length);
      monitor.maxVideos = Math.max(monitor.maxVideos, [...document.querySelectorAll('video')].filter((video) => !video.paused).length);
    }, 16);
    return true;
  })()`);
}

async function startFresh(label) {
  await send("Page.navigate", { url: `${origin}/?filmPass=${label}` });
  await waitFor("application shell", `Boolean(document.querySelector('[data-testid="scene-director"]'))`, 30_000);
  await evaluate(`localStorage.removeItem('soulbound.answer.v1')`);
  await send("Page.reload", { ignoreCache: false });
  await waitFor("fresh film shell", `Boolean(document.querySelector('[data-testid="scene-director"]'))`, 30_000);
  await installMonitor();
}

async function runFilm(branch) {
  await startFresh(branch.toLowerCase());
  await waitForScene("PROLOGUE", 30_000);
  await waitFor("Open Soul reveal", `(() => { const button = document.querySelector('[data-testid="open-soul"]'); return Boolean(button && !button.disabled && Number(getComputedStyle(button).opacity) > .45); })()`, 25_000);
  await clickUnique('[data-testid="open-soul"]');

  await waitForScene("S01", 12_000);
  await continueOnce("S01", 30_000);

  await waitForScene("S02", 12_000);
  await waitFor("special notification", `(() => { const button = document.querySelector('[data-testid="special-notification"]'); return Boolean(button && !button.disabled); })()`, 20_000);
  await clickUnique('[data-testid="special-notification"]');
  await continueOnce("S02", 20_000);

  await waitForScene("S03", 12_000);
  await continueOnce("S03", 45_000);

  await waitForScene("S04", 12_000);
  await continueOnce("S04", 30_000);

  await waitForScene("S05", 12_000);
  await clickUnique('[data-testid="morning-light-target"]');
  await continueOnce("S05", 35_000);

  await waitForScene("S06", 12_000);
  await clickUnique('[data-testid="heart-reaction-hotspot"]');
  await continueOnce("S06", 30_000);

  await waitForScene("S07", 12_000);
  await continueOnce("S07", 45_000);

  await waitForScene("S08", 12_000);
  await continueOnce("S08", 35_000);

  await waitForScene("S09", 12_000);
  await waitFor("pain hold enabled", `(() => { const button = document.querySelector('[aria-label="Удерживай, чтобы принять часть боли"]'); return Boolean(button && !button.disabled); })()`, 35_000);
  await evaluate(`(() => { const button = document.querySelector('[aria-label="Удерживай, чтобы принять часть боли"]'); button?.focus(); button?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })); })()`);
  await sleep(2_900);
  await evaluate(`document.querySelector('[aria-label="Удерживай, чтобы принять часть боли"]')?.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true, cancelable: true }))`);
  await continueOnce("S09", 25_000);

  await waitForScene("S10", 12_000);
  await continueOnce("S10", 55_000);

  await waitForScene("PRE_FINAL", 12_000);
  await continueOnce("PRE_FINAL", 35_000);
  await waitForScene("SOULS_RELEASE", 12_000);
  await waitForScene("REQUIEM", 20_000);
  await waitForScene("SILENCE", 35_000);
  const silence = await filmSnapshot();
  assert.equal(silence.playingVideos, 0);
  assert.equal(silence.hud, "HIDDEN");
  await waitForScene("FINAL", 35_000);
  await waitFor("answer controls", `document.querySelectorAll('[data-testid="final-scene"] fieldset button').length === 2`, 35_000);
  await evaluate(`(() => { const buttons = [...document.querySelectorAll('[data-testid="final-scene"] fieldset button')]; const button = buttons[${branch === "YES" ? 0 : 1}]; button?.click(); button?.click(); })()`);
  await waitFor(`${branch} stable`, `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-answer-state') === '${branch}'`, branch === "YES" ? 20_000 : 8_000);
  const settled = await filmSnapshot();
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
  assert.match(settled.stored ?? "", new RegExp(`\"result\":\"${branch}\"`));
  await screenshot(`full-film-${branch.toLowerCase()}-stable.png`);
  return settled;
}

await fs.mkdir(artifactDirectory, { recursive: true });
await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

const yes = await runFilm("YES");
const think = await runFilm("THINK");
const seriousErrors = browserErrors.filter((message) =>
  !message.includes("favicon.ico") &&
  !message.includes("/_next/hmr") &&
  !message.includes("Failed to load resource: the server responded with a status of 404"),
);
assert.deepEqual(seriousErrors, []);
console.log(JSON.stringify({ ok: true, yes, think, browserErrors: seriousErrors, artifacts: artifactDirectory }, null, 2));
socket.close();
