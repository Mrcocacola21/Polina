import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const endpoint = process.env.SOULBOUND_CDP ?? "http://127.0.0.1:9226";
const origin = process.env.SOULBOUND_ORIGIN ?? "http://localhost:3000";
const width = Number(process.env.SOULBOUND_VIEWPORT_WIDTH ?? 1920);
const height = Number(process.env.SOULBOUND_VIEWPORT_HEIGHT ?? 1080);
const branch = process.env.SOULBOUND_ENDING === "THINK" ? "THINK" : "YES";
const pass = process.env.SOULBOUND_VISUAL_PASS ?? "final";
const requestedQuality = ["HIGH", "MEDIUM", "LOW"].includes(process.env.SOULBOUND_VISUAL_QUALITY ?? "")
  ? process.env.SOULBOUND_VISUAL_QUALITY
  : null;
const artifactDirectory = path.resolve(".next", `phase17-${pass}-${width}x${height}-${branch.toLowerCase()}`);
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
const frames = [];
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
    await sleep(80);
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
      canvases: document.querySelectorAll('canvas').length,
      videos: [...document.querySelectorAll('video')].filter((video) => !video.paused).length,
      body: getComputedStyle(document.body).backgroundColor,
      stored: localStorage.getItem('soulbound.answer.v1'),
    };
  })()`);
}

async function auditFrame(name) {
  await screenshot(`${String(frames.length + 1).padStart(2, "0")}-${name}.png`);
  const audit = await evaluate(`(() => {
    const director = document.querySelector('[data-testid="scene-director"]');
    const root = director?.querySelector('section') ?? director;
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > .025 && rect.width > 1 && rect.height > 1;
    };
    const rectOf = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName.toLowerCase(),
        testId: element.getAttribute('data-testid') || '',
        text: (element.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 180),
        x: Math.round(rect.x * 10) / 10,
        y: Math.round(rect.y * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
        opacity: Number(getComputedStyle(element).opacity),
        fontSize: getComputedStyle(element).fontSize,
        lineHeight: getComputedStyle(element).lineHeight,
      };
    };
    const elements = root ? [...root.querySelectorAll('h1,h2,p,button,output,time,[data-media-status]')].filter(visible).map(rectOf) : [];
    const overflows = elements.filter((item) => item.x < -1 || item.y < -1 || item.x + item.width > innerWidth + 1 || item.y + item.height > innerHeight + 1);
    const hud = document.querySelector('[data-testid="soul-hud"]');
    const cursor = document.querySelector('[data-cursor-mode]');
    return {
      label: ${JSON.stringify(name)},
      scene: director?.getAttribute('data-scene-id') || '',
      phase: director?.getAttribute('data-scene-phase') || '',
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      visualQuality: document.documentElement.dataset.visualQuality || 'production-default',
      documentOverflow: { x: document.documentElement.scrollWidth - innerWidth, y: document.documentElement.scrollHeight - innerHeight },
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      sceneBackground: root ? getComputedStyle(root).backgroundColor : '',
      canvases: document.querySelectorAll('canvas').length,
      cursorMode: cursor?.getAttribute('data-cursor-mode') || '',
      hudMode: hud?.getAttribute('data-hud-mode') || '',
      elements,
      overflows,
    };
  })()`);
  frames.push(audit);
}

async function clickUnique(selector) {
  const count = await evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
  assert.equal(count, 1, `Expected exactly one ${selector}`);
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`, true);
}

async function waitForScene(sceneId, timeout = 60_000) {
  await waitFor(`${sceneId} active`, `(() => { const director = document.querySelector('[data-testid="scene-director"]'); return director?.getAttribute('data-scene-id') === '${sceneId}' && director?.getAttribute('data-scene-phase') === 'active'; })()`, timeout);
}

async function waitForContinue(sceneId, timeout = 60_000) {
  await waitFor(`${sceneId} continue`, `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === '${sceneId}' && Boolean(document.querySelector('[data-testid="cinematic-continue"]'))`, timeout);
}

async function continueScene(sceneId, frameName, timeout = 60_000) {
  if (/^S(?:0[1-9]|10)$/.test(sceneId)) {
    await waitFor(`${sceneId} explicit Soul claim`, `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === '${sceneId}' && Boolean(document.querySelector('[data-testid="soul-claim-target"]'))`, timeout);
    await evaluate(`(() => { const target = document.querySelector('[data-testid="soul-claim-target"]'); target?.focus(); target?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true })); })()`, true);
  }
  await waitForContinue(sceneId, timeout);
  if (frameName) await auditFrame(frameName);
  await clickUnique('[data-testid="cinematic-continue"]');
}

async function startFresh() {
  await send("Page.navigate", { url: `${origin}/?phase17Film=${branch.toLowerCase()}` });
  await waitFor("application shell", `Boolean(document.querySelector('[data-testid="scene-director"]'))`, 30_000);
  await evaluate(`localStorage.removeItem('soulbound.answer.v1'); sessionStorage.clear()`);
  await send("Page.reload", { ignoreCache: false });
  await waitFor("fresh film shell", `Boolean(document.querySelector('[data-testid="scene-director"]'))`, 30_000);
  if (requestedQuality) {
    await waitFor("development visual quality hook", `Boolean(document.documentElement.dataset.visualQuality)`, 10_000);
    await evaluate(`window.dispatchEvent(new CustomEvent('soulbound:debug-visual-quality', { detail: { quality: '${requestedQuality}' } }))`);
    await waitFor(`${requestedQuality} visual quality`, `document.documentElement.dataset.visualQuality === '${requestedQuality}'`, 5_000);
  }
}

await fs.mkdir(artifactDirectory, { recursive: true });
await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
await startFresh();

if ((await snapshot()).scene === "PRELOADER") {
  await sleep(350);
  await auditFrame("preloader-stable");
}

await waitForScene("PROLOGUE", 30_000);
await waitFor("Open Soul", `(() => { const button = document.querySelector('[data-testid="open-soul"]'); return Boolean(button && !button.disabled && Number(getComputedStyle(button).opacity) > .45); })()`, 25_000);
await auditFrame("prologue-open-soul");
await clickUnique('[data-testid="open-soul"]');

await waitForScene("S01", 15_000);
await waitFor("S01 phrase", `(() => [...document.querySelectorAll('[data-testid="s01-scene"] p span')].some((span) => Number(getComputedStyle(span).opacity) > .55))()`, 20_000);
await auditFrame("s01-phrase");
await continueScene("S01", null, 35_000);
await waitForScene("S02", 15_000);
await waitFor("special notification", `(() => { const button = document.querySelector('[data-testid="special-notification"]'); return Boolean(button && !button.disabled); })()`, 20_000);
await auditFrame("s02-special-notification");
await clickUnique('[data-testid="special-notification"]');
await waitFor("S02 phrase", `(() => [...document.querySelectorAll('[data-testid="s02-scene"] p span')].some((span) => Number(getComputedStyle(span).opacity) > .55))()`, 12_000);
await auditFrame("s02-phrase");
await continueScene("S02", null, 25_000);
await waitForScene("S03", 15_000); await continueScene("S03", "s03-three-memories", 45_000);
await waitForScene("S04", 15_000);
await waitFor("S04 phrase", `(() => [...document.querySelectorAll('[data-testid="s04-scene"] p')].some((p) => Number(getComputedStyle(p).opacity) > .55))()`, 15_000);
await auditFrame("s04-thread");
await continueScene("S04", null, 30_000);
await waitForScene("S05", 15_000);
await clickUnique('[data-testid="morning-light-target"]');
await waitFor("S05 phrase", `(() => [...document.querySelectorAll('[data-testid="s05-scene"] p span')].some((span) => Number(getComputedStyle(span).opacity) > .55))()`, 18_000);
await auditFrame("s05-post-light");
await continueScene("S05", null, 35_000);
await waitForScene("S06", 15_000);
await clickUnique('[data-testid="heart-reaction-hotspot"]');
await waitFor("S06 phrase", `(() => [...document.querySelectorAll('[data-testid="s06-scene"] p span')].some((span) => Number(getComputedStyle(span).opacity) > .55))()`, 14_000);
await auditFrame("s06-post-heart");
await continueScene("S06", null, 30_000);
await waitForScene("S07", 15_000);
await waitFor("S07 portrait", `(() => { const media = document.querySelector('[data-testid="s07-scene"] video'); const shell = media?.parentElement?.parentElement; return shell && Number(getComputedStyle(shell).opacity) > .35; })()`, 12_000);
await auditFrame("s07-portrait");
await waitFor("S07 rating infinity", `document.querySelector('[data-testid="s07-scene"]')?.getAttribute('data-rating-resolved') === 'true'`, 30_000);
await auditFrame("s07-rating-infinity");
await continueScene("S07", "s07-parenthetical", 25_000);
await waitForScene("S08", 15_000);
await waitFor("S08 first declaration", `(() => { const p = document.querySelector('[data-testid="s08-scene"] p[aria-label]'); const s = p?.querySelector('span'); return s && Number(getComputedStyle(s).opacity) > .55; })()`, 20_000);
await auditFrame("s08-first-declaration");
await waitFor("S08 second declaration", `(() => { const spans = document.querySelectorAll('[data-testid="s08-scene"] p[aria-label] > span'); return spans.length > 2 && Number(getComputedStyle(spans[2]).opacity) > .55; })()`, 20_000);
await auditFrame("s08-second-declaration");
await continueScene("S08", "s08-settle", 25_000);
await waitForScene("S09", 15_000);
await waitFor("pain hold", `(() => { const button = document.querySelector('[aria-label="Удерживай, чтобы принять часть боли"]'); return Boolean(button && !button.disabled); })()`, 35_000);
await auditFrame("s09-pre-hold");
await evaluate(`(() => { const button = document.querySelector('[aria-label="Удерживай, чтобы принять часть боли"]'); button?.focus(); button?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true })); })()`, true);
await sleep(1_350);
await auditFrame("s09-half-hold");
await sleep(1_400);
await evaluate(`document.querySelector('[aria-label="Удерживай, чтобы принять часть боли"]')?.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true, cancelable: true }))`, true);
await continueScene("S09", "s09-complete", 30_000);
await waitForScene("S10", 15_000);
await waitFor("S10 calm beat", `(() => [...document.querySelectorAll('[data-testid="s10-scene"] p > span')].some((span) => span.textContent?.includes('люблю тебя') && Number(getComputedStyle(span).opacity) > .55))()`, 35_000);
await auditFrame("s10-calm-beat");
await continueScene("S10", "s10-final-fear", 40_000);
await waitForScene("PRE_FINAL", 15_000); await continueScene("PRE_FINAL", "pre-final", 35_000);
await waitForScene("SOULS_RELEASE", 15_000); await sleep(3_250); await auditFrame("souls-release-constellation");
await waitForScene("REQUIEM", 20_000);
await waitFor("Requiem radial", `document.querySelector('[data-testid="requiem-scene"]')?.getAttribute('data-rings') === '3'`, 20_000);
await auditFrame("requiem-radial");
await waitFor("Requiem hero", `['hero','release'].includes(document.querySelector('[data-testid="requiem-scene"]')?.getAttribute('data-requiem-phase'))`, 20_000);
await auditFrame("requiem-hero-peak");
await waitForScene("SILENCE", 35_000);
await waitFor("Silence line", `(() => [...document.querySelectorAll('[data-testid="silence-scene"] p')].some((p) => Number(getComputedStyle(p).opacity) > .55))()`, 20_000);
await auditFrame("silence-line");
await waitForScene("FINAL", 35_000);
await waitFor("Final full question", `Boolean(document.querySelector('[data-testid="final-scene"] p[aria-label="Можна я буду с тобой сердцем и душой?"]'))`, 30_000);
await auditFrame("final-question");
await waitFor("answer controls", `document.querySelectorAll('[data-testid="final-scene"] fieldset button').length === 2`, 20_000);
await waitFor("answer controls visible", `(() => { const button = document.querySelector('[data-testid="final-scene"] fieldset button'); return Boolean(button && Number(getComputedStyle(button).opacity) > .7 && button.getBoundingClientRect().height >= 44); })()`, 5_000);
await auditFrame("final-answers");
const answerSelector = `[data-testid="final-scene"] fieldset button[data-answer="${branch}"]`;
const answerCount = await evaluate(`document.querySelectorAll(${JSON.stringify(answerSelector)}).length`);
if (answerCount === 1) await clickUnique(answerSelector);
else await evaluate(`document.querySelectorAll('[data-testid="final-scene"] fieldset button')[${branch === "YES" ? 0 : 1}]?.click()`, true);
await waitFor(`${branch} stable`, `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-answer-state') === '${branch}'`, branch === "YES" ? 25_000 : 10_000);
await auditFrame(`${branch.toLowerCase()}-stable`);

const settled = await snapshot();
assert.equal(settled.scene, "FINAL");
assert.equal(settled.phase, "active");
assert.equal(settled.answer, branch);
assert.equal(settled.bridge, "idle");
assert.equal(settled.mask, "idle");
assert.equal(settled.canvases, 1);
assert.equal(settled.body, "rgb(0, 0, 0)");
assert.match(settled.stored ?? "", new RegExp(`"result":"${branch}"`));
for (const frame of frames) {
  assert.deepEqual(frame.viewport, { width, height, dpr: 1 });
  if (requestedQuality) assert.equal(frame.visualQuality, requestedQuality);
  assert.equal(frame.documentOverflow.x, 0, `${frame.label} has horizontal document overflow`);
  assert.equal(frame.documentOverflow.y, 0, `${frame.label} has vertical document overflow`);
  assert.equal(frame.canvases, 1, `${frame.label} must retain one Canvas`);
}
const seriousErrors = browserErrors.filter((message) => !message.includes("favicon.ico") && !message.includes("/_next/hmr") && !message.includes("Failed to load resource: the server responded with a status of 404"));
assert.deepEqual(seriousErrors, []);
const report = { ok: true, pass, branch, target: { width, height, dpr: 1, quality: requestedQuality ?? "production-default" }, frames, final: settled, browserErrors: seriousErrors, artifacts: artifactDirectory };
await fs.writeFile(path.join(artifactDirectory, "audit.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, pass, branch, target: report.target, frames: frames.length, artifacts: artifactDirectory }, null, 2));
socket.close();
