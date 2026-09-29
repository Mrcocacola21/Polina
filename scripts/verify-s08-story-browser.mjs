import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const endpoint = process.env.SOULBOUND_CDP ?? "http://127.0.0.1:9226";
const origin = process.env.SOULBOUND_ORIGIN ?? "http://localhost:3000";
const artifactDirectory = path.resolve(".next", "s08-story-qa");
const allCases = [
  { label: "1920x1080", width: 1920, height: 1080, mobile: false, reducedMotion: false },
  { label: "2560x1440", width: 2560, height: 1440, mobile: false, reducedMotion: false },
  { label: "390x844-mobile", width: 390, height: 844, mobile: true, reducedMotion: false },
  { label: "1920x1080-reduced", width: 1920, height: 1080, mobile: false, reducedMotion: true },
];
const caseFilter = process.env.SOULBOUND_S08_CASE;
const cases = caseFilter ? allCases.filter(({ label }) => label === caseFilter) : allCases;
if (!cases.length) throw new Error("S08 browser QA case filter did not match a configured case.");
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

await mkdir(artifactDirectory, { recursive: true });
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

async function waitFor(label, expression, timeout = 35_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await sleep(80);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function capture(filename) {
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(path.join(artifactDirectory, filename), Buffer.from(result.data, "base64"));
}

async function auditBeat(expectedStage) {
  return evaluate(`(() => {
    const root = document.querySelector('[data-testid="s08-scene"]');
    const evidence = document.querySelector('[data-testid="s08-queen-evidence"]');
    const image = evidence?.querySelector('img');
    const first = root?.querySelector('p[aria-label] > span:first-child');
    const phraseSpans = root?.querySelectorAll('p[aria-label] > span');
    const second = phraseSpans?.[2];
    const rect = (element) => {
      const value = element?.getBoundingClientRect();
      return value ? { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom } : null;
    };
    const evidenceRect = evidence?.getBoundingClientRect();
    const clipPath = evidence ? getComputedStyle(evidence).clipPath : '';
    const clipValues = [...clipPath.matchAll(/([\\d.]+)%/g)].map((match) => Number(match[1]) / 100);
    const visibleEvidenceRect = evidenceRect && clipValues.length === 4 ? {
      x: evidenceRect.x + evidenceRect.width * clipValues[3],
      y: evidenceRect.y + evidenceRect.height * clipValues[0],
      right: evidenceRect.right - evidenceRect.width * clipValues[1],
      bottom: evidenceRect.bottom - evidenceRect.height * clipValues[2],
    } : null;
    return {
      beat: root?.dataset.sceneBeat,
      stage: root?.dataset.screenshotStage,
      expectedStage: ${JSON.stringify(expectedStage)},
      imageCount: evidence?.querySelectorAll('img').length ?? 0,
      imageSource: image?.currentSrc ?? '',
      naturalSize: image ? { width: image.naturalWidth, height: image.naturalHeight } : null,
      clipPath,
      evidenceOpacity: evidence ? Number(getComputedStyle(evidence).opacity) : 0,
      evidenceRect: rect(evidence),
      visibleEvidenceRect,
      evidenceTransform: evidence ? getComputedStyle(evidence).transform : '',
      stageRect: rect(evidence?.parentElement),
      stageTransform: evidence?.parentElement ? getComputedStyle(evidence.parentElement).transform : '',
      firstOpacity: first ? Number(getComputedStyle(first).opacity) : 0,
      secondOpacity: second ? Number(getComputedStyle(second).opacity) : 0,
      firstRect: rect(first),
      secondRect: rect(second),
      documentOverflow: {
        x: document.documentElement.scrollWidth - innerWidth,
        y: document.documentElement.scrollHeight - innerHeight,
      },
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    };
  })()`);
}

await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
const report = [];

for (const current of cases) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: current.width,
    height: current.height,
    deviceScaleFactor: 1,
    mobile: current.mobile,
  });
  await send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: current.reducedMotion ? "reduce" : "no-preference" }],
  });
  await send("Page.navigate", { url: `${origin}/?debug=1&s08Story=${current.label}` });
  await waitFor(`${current.label} SceneDirector`, `Boolean(document.querySelector('[data-testid="scene-director"]'))`);
  await evaluate(`localStorage.clear(); sessionStorage.clear()`);
  await send("Page.reload", { ignoreCache: false });
  await waitFor(`${current.label} debug overlay`, `Boolean(document.querySelector('[data-testid="scene-debug-overlay"]'))`);
  await evaluate(`(() => {
    const style = document.createElement('style');
    style.id = 's08-story-hide-debug-ui';
    style.textContent = 'body aside, [data-testid="asset-diagnostics"] { display: none !important; }';
    document.head.append(style);
    for (const id of ['scene-debug-overlay','media-debug-panel','performance-debug-panel','audio-debug-panel','asset-diagnostics']) {
      const element = document.querySelector('[data-testid="' + id + '"]');
      if (element) element.style.display = 'none';
    }
    window.dispatchEvent(new CustomEvent('soulbound:debug-visual-quality', { detail: { quality: 'HIGH' } }));
    window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: 'S08' } }));
  })()`);
  await waitFor(`${current.label} S08 active`, `(() => { const director = document.querySelector('[data-testid="scene-director"]'); return director?.dataset.sceneId === 'S08' && director?.dataset.scenePhase === 'active'; })()`);

  await waitFor(`${current.label} first phrase`, `(() => {
    const root = document.querySelector('[data-testid="s08-scene"]');
    const first = root?.querySelector('p[aria-label] > span:first-child');
    return root?.dataset.sceneBeat === 'first-phrase' && first && Number(getComputedStyle(first).opacity) >= .85;
  })()`);
  const first = await auditBeat("five-kills");
  assert.equal(first.stage, "five-kills");
  assert.equal(first.imageCount, 1);
  assert.deepEqual(first.naturalSize, { width: 932, height: 703 });
  assert.match(first.clipPath, /18\.777%/);
  assert.match(first.clipPath, /62\.232%/);
  assert.ok(first.evidenceOpacity >= 0.9);
  assert.ok(first.firstOpacity >= 0.85);
  assert.ok(first.secondOpacity <= 0.05);
  assert.ok(first.visibleEvidenceRect.right > 0 && first.visibleEvidenceRect.x < current.width);
  assert.ok(first.visibleEvidenceRect.bottom > 0 && first.visibleEvidenceRect.y < current.height);
  assert.deepEqual(first.documentOverflow, { x: 0, y: 0 });
  await capture(`${current.label}-five-kills.png`);

  await waitFor(`${current.label} second phrase`, `(() => {
    const root = document.querySelector('[data-testid="s08-scene"]');
    const spans = root?.querySelectorAll('p[aria-label] > span');
    const second = spans?.[2];
    return root?.dataset.sceneBeat === 'second-phrase' && second && Number(getComputedStyle(second).opacity) >= .85;
  })()`);
  const second = await auditBeat("death-reveal");
  assert.equal(second.stage, "death-reveal");
  assert.equal(second.imageCount, 1);
  assert.equal(second.imageSource, first.imageSource);
  assert.match(second.clipPath, /4\.836%/);
  assert.match(second.clipPath, /4\.185%/);
  if (current.mobile) {
    assert.match(second.clipPath, /48\.498%/);
    assert.match(second.clipPath, /70\.839%/);
  } else {
    assert.match(second.clipPath, /0px|0%/);
  }
  assert.ok(second.firstOpacity <= 0.05);
  assert.ok(second.secondOpacity >= 0.85);
  assert.ok(second.visibleEvidenceRect.right > 0 && second.visibleEvidenceRect.x < current.width);
  assert.ok(second.visibleEvidenceRect.bottom > 0 && second.visibleEvidenceRect.y < current.height);
  assert.deepEqual(second.documentOverflow, { x: 0, y: 0 });
  await capture(`${current.label}-death-reveal.png`);

  await waitFor(`${current.label} Soul 8 waiting`, `document.querySelector('[data-testid="soul-claim-target"]')?.dataset.soulId === 'SOUL_08'`, 30_000);
  const waiting = await auditBeat("hidden");
  assert.equal(waiting.imageCount, 1);
  assert.ok(waiting.evidenceOpacity <= 0.08);
  await capture(`${current.label}-soul-waiting.png`);
  report.push({ current, first, second, waiting });
}

const seriousErrors = browserErrors.filter((message) => !message.includes("favicon.ico") && !message.includes("/_next/hmr") && !message.includes("Failed to load resource: the server responded with a status of 404"));
assert.deepEqual(seriousErrors, []);
await writeFile(path.join(artifactDirectory, "audit.json"), `${JSON.stringify({ ok: true, report }, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, cases: report.length, artifacts: artifactDirectory }, null, 2));
socket.close();
