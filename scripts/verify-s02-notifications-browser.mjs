import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const endpoint = process.env.SOULBOUND_CDP ?? "http://127.0.0.1:9226";
const origin = process.env.SOULBOUND_ORIGIN ?? "http://localhost:3000";
const artifactDirectory = path.resolve(".next", "s02-notification-qa");
const fallbackOnly = process.env.SOULBOUND_S02_FALLBACK_ONLY === "1";
const audioOnly = process.env.SOULBOUND_S02_AUDIO_ONLY === "1";
const configuredViewports = [
  { label: "1920x1080", width: 1920, height: 1080, mobile: false, reducedMotion: false },
  { label: "2560x1440", width: 2560, height: 1440, mobile: false, reducedMotion: false },
  { label: "390x844", width: 390, height: 844, mobile: true, reducedMotion: false },
  { label: "1280x720-reduced", width: 1280, height: 720, mobile: false, reducedMotion: true },
];
const viewports = fallbackOnly ? [] : audioOnly ? configuredViewports.slice(0, 1) : configuredViewports;
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const tabs = await fetch(`${endpoint}/json/list`).then((response) => response.json());
const page = tabs.find((tab) => tab.type === "page" && tab.url === "about:blank")
  ?? tabs.find((tab) => tab.type === "page");
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
  if (message.method === "Runtime.exceptionThrown") {
    browserErrors.push(message.params.exceptionDetails.text);
  }
  if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
    browserErrors.push(message.params.entry.text);
  }
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
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture,
  });
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

async function claimSoulByPointer() {
  const target = await evaluate(`(() => {
    const target = document.querySelector('[data-testid="soul-claim-target"]');
    if (!target) return null;
    const rect = target.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  })()`);
  assert.ok(target);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 2, y: 2 });
  await sleep(80);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: target.x, y: target.y });
}

async function auditNotifications() {
  return evaluate(`(() => {
    const scene = document.querySelector('[data-testid="s02-scene"]');
    const one = scene?.querySelector('[data-notification-asset="not1"]');
    const two = scene?.querySelector('[data-notification-asset="not2"]');
    const special = scene?.querySelector('[data-notification-asset="notPolina"]');
    const rect = (element) => {
      const value = element?.getBoundingClientRect();
      return value ? { x: value.x, y: value.y, width: value.width, height: value.height, right: value.right, bottom: value.bottom } : null;
    };
    const image = (element) => element?.querySelector('img');
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentOverflow: { x: document.documentElement.scrollWidth - innerWidth, y: document.documentElement.scrollHeight - innerHeight },
      syntheticCopyPresent: ['NIGHT SIGNAL', 'QUIET CHANNEL', 'SOUL FREQUENCY', 'background event', 'new activity', 'something familiar'].some((copy) => scene?.textContent?.includes(copy)),
      buttons: scene?.querySelectorAll('button').length ?? 0,
      one: { opacity: Number(getComputedStyle(one).opacity), rect: rect(one), src: image(one)?.getAttribute('src') ?? '', status: one?.querySelector('[data-media-status]')?.getAttribute('data-media-status') ?? '' },
      two: { opacity: Number(getComputedStyle(two).opacity), rect: rect(two), src: image(two)?.getAttribute('src') ?? '', status: two?.querySelector('[data-media-status]')?.getAttribute('data-media-status') ?? '' },
      special: { opacity: Number(getComputedStyle(special).opacity), rect: rect(special), imageRect: rect(image(special)), src: image(special)?.getAttribute('src') ?? '', status: special?.querySelector('[data-media-status]')?.getAttribute('data-media-status') ?? '', disabled: special?.disabled, ariaLabel: special?.getAttribute('aria-label') ?? '' },
    };
  })()`);
}

function assertRectInside(rect, viewport, label) {
  assert.ok(rect, `${label} has a rectangle`);
  assert.ok(rect.x >= -1 && rect.y >= -1, `${label} starts inside the viewport`);
  assert.ok(rect.right <= viewport.width + 1 && rect.bottom <= viewport.height + 1, `${label} ends inside the viewport`);
}

async function jumpTo(sceneId) {
  await evaluate(`window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: '${sceneId}' } }))`);
  await sleep(240);
  if (await evaluate(`document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') !== '${sceneId}'`)) {
    await evaluate(`window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: '${sceneId}' } }))`);
  }
  await waitFor(`${sceneId} active`, `(() => { const director = document.querySelector('[data-testid="scene-director"]'); return director?.getAttribute('data-scene-id') === '${sceneId}' && director?.getAttribute('data-scene-phase') === 'active'; })()`, 35_000);
}

async function configureViewport(viewport) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.mobile,
  });
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: viewport.reducedMotion ? "reduce" : "no-preference" }],
  });
  await send("Page.navigate", { url: `${origin}/?debug=1&s02NotificationQa=${viewport.label}` });
  await waitFor("SceneDirector", `Boolean(document.querySelector('[data-testid="scene-director"]'))`);
  await evaluate(`(() => { sessionStorage.clear(); const style = document.createElement('style'); style.textContent = '[data-testid="scene-debug-overlay"], [data-testid="audio-debug-panel"], [data-testid="media-debug-panel"], [data-testid="performance-debug-panel"] { display: none !important; }'; document.head.append(style); })()`);
  await sleep(500);
}

await fs.mkdir(artifactDirectory, { recursive: true });
await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");

const report = [];
for (const [index, viewport] of viewports.entries()) {
  await configureViewport(viewport);

  if (index === 0) {
    await waitFor("PROLOGUE active", `(() => { const director = document.querySelector('[data-testid="scene-director"]'); return director?.getAttribute('data-scene-id') === 'PROLOGUE' && director?.getAttribute('data-scene-phase') === 'active'; })()`, 30_000);
    await waitFor("Open Soul", `(() => { const button = document.querySelector('[data-testid="open-soul"]'); return Boolean(button && !button.disabled); })()`, 25_000);
    await evaluate(`document.querySelector('[data-testid="open-soul"]').click()`, true);
    await waitFor("S01 active", `(() => { const director = document.querySelector('[data-testid="scene-director"]'); return director?.getAttribute('data-scene-id') === 'S01' && director?.getAttribute('data-scene-phase') === 'active'; })()`, 15_000);
    await waitFor("S01 waiting Soul", `document.querySelector('[data-testid="soul-claim-target"]')?.getAttribute('data-soul-id') === 'SOUL_01'`, 30_000);
    await claimSoulByPointer();
    await waitFor("S01 continue", `Boolean(document.querySelector('[data-testid="cinematic-continue"]'))`, 12_000);
    await evaluate(`document.querySelector('[data-testid="cinematic-continue"]').click()`, true);
    await waitFor("S01 to S02 transition", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'S02'`, 15_000);
    await waitFor("S02 active", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-phase') === 'active'`, 10_000);
  } else {
    await jumpTo("S02");
  }

  await sleep(1_150);
  const not1 = await auditNotifications();
  assert.deepEqual(not1.viewport, { width: viewport.width, height: viewport.height });
  assert.deepEqual(not1.documentOverflow, { x: 0, y: 0 });
  assert.equal(not1.syntheticCopyPresent, false);
  assert.equal(not1.buttons, 1);
  assert.ok(not1.one.opacity > 0.5);
  assert.ok(not1.one.src.includes("/assets/Screens/not1.png"));
  assert.equal(not1.one.status, "ready");
  assertRectInside(not1.one.rect, not1.viewport, "not1");
  await screenshot(`${viewport.label}-not1.png`);

  await sleep(3_450);
  const not2 = await auditNotifications();
  assert.ok(not2.one.opacity < 0.1);
  assert.ok(not2.two.opacity > 0.5);
  assert.ok(not2.two.src.includes("/assets/Screens/not2.png"));
  assert.equal(not2.two.status, "ready");
  assertRectInside(not2.two.rect, not2.viewport, "not2");
  await screenshot(`${viewport.label}-not2.png`);

  await sleep(3_550);
  const special = await auditNotifications();
  assert.ok(special.one.opacity < 0.1);
  assert.ok(special.two.opacity < 0.1);
  assert.ok(special.special.opacity > 0.5);
  assert.equal(special.special.disabled, false);
  assert.equal(special.special.ariaLabel, "Открыть уведомление");
  assert.ok(special.special.src.includes("/assets/Screens/notPolina.png"));
  assert.equal(special.special.status, "ready");
  assertRectInside(special.special.rect, special.viewport, "notPolina");
  assert.ok(Math.abs(special.special.rect.width - special.special.imageRect.width) < 1);
  assert.ok(Math.abs(special.special.rect.height - special.special.imageRect.height) < 1);
  await screenshot(`${viewport.label}-notPolina.png`);

  const decodedBeforeOpen = index === 0
    ? Number(await evaluate(`document.querySelector('[data-testid="audio-decoded-count"]')?.textContent ?? 0`))
    : null;
  await evaluate(`document.querySelector('[data-testid="special-notification"]').click()`, true);
  await waitFor("notPolina opened", `document.querySelector('[data-testid="s02-scene"]')?.getAttribute('data-special-opened') === 'true'`);
  if (decodedBeforeOpen !== null) {
    await waitFor("both notification-open sounds decoded", `Number(document.querySelector('[data-testid="audio-decoded-count"]')?.textContent ?? 0) >= ${decodedBeforeOpen + 2}`);
  }
  await sleep(3_650);
  const phraseVisible = await evaluate(`(() => { const scene = document.querySelector('[data-testid="s02-scene"]'); return scene?.querySelector('p')?.getAttribute('aria-label') === 'Каждый раз, когда я вижу уведомление, я надеюсь, что оно от тебя' && [...scene.querySelectorAll('p > span')].every((line) => Number(getComputedStyle(line).opacity) > .5); })()`);
  assert.equal(phraseVisible, true);
  await screenshot(`${viewport.label}-notPolina-open.png`);

  await waitFor("Soul 2 waiting", `document.querySelector('[data-testid="soul-claim-target"]')?.getAttribute('data-soul-id') === 'SOUL_02'`, 16_000);
  const soulVoice = await evaluate(`document.querySelector('[data-testid="soul-claim-target"]')?.getAttribute('aria-label')`);
  assert.equal(soulVoice, "Collect Soul 02 of 10");
  await screenshot(`${viewport.label}-soul-2-waiting.png`);
  await claimSoulByPointer();
  await waitFor("Soul 2 accepts hover claim", `!document.querySelector('[data-testid="soul-claim-target"]')`, 3_000);
  await waitFor("S02 continue", `Boolean(document.querySelector('[data-testid="cinematic-continue"]'))`, 12_000);
  await evaluate(`document.querySelector('[data-testid="cinematic-continue"]').click()`, true);
  await waitFor("S02 to S03 transition", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'S03'`, 15_000);

  report.push({
    viewport: viewport.label,
    reducedMotion: viewport.reducedMotion,
    not1: not1.one.rect,
    not2: not2.two.rect,
    notPolina: special.special.rect,
    transitions: index === 0 ? ["S01→S02", "S02→S03"] : ["S02→S03"],
    soul2Claim: "pointer-hover",
    openSoundDecodeDelta: decodedBeforeOpen === null
      ? null
      : Number(await evaluate(`document.querySelector('[data-testid="audio-decoded-count"]')?.textContent ?? 0`)) - decodedBeforeOpen,
  });
}

let fallbackReport = null;
if (fallbackOnly) {
  const viewport = { label: "1280x720-image-fallback", width: 1280, height: 720, mobile: false, reducedMotion: false };
  await send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${origin}/?debug=1&failureLab=1&s02NotificationFallbackQa=1` });
  await waitFor("Failure Lab", `Boolean(document.querySelector('[data-testid="failure-lab"]'))`, 40_000);
  await sleep(500);
  const failureButtonCount = await evaluate(`[...document.querySelectorAll('[data-testid="failure-lab"] button')].filter((button) => button.textContent?.trim() === 'FAIL IMAGE').length`);
  assert.equal(failureButtonCount, 1);
  await evaluate(`[...document.querySelectorAll('[data-testid="failure-lab"] button')].find((button) => button.textContent?.trim() === 'FAIL IMAGE').click()`);
  await evaluate(`(() => { const style = document.createElement('style'); style.textContent = '[data-testid="failure-lab"], [data-testid="audio-debug-panel"], [data-testid="media-debug-panel"], [data-testid="performance-debug-panel"] { display: none !important; }'; document.head.append(style); })()`);
  await jumpTo("S02");

  await sleep(1_150);
  const not1Fallback = await auditNotifications();
  assert.ok(not1Fallback.one.opacity > 0.5);
  assert.equal(not1Fallback.one.src, "");
  assert.equal(not1Fallback.one.status, "loading");
  await screenshot("1280x720-image-fallback-not1.png");

  await sleep(3_450);
  const not2Fallback = await auditNotifications();
  assert.ok(not2Fallback.two.opacity > 0.5);
  assert.equal(not2Fallback.two.src, "");
  assert.equal(not2Fallback.two.status, "loading");
  await screenshot("1280x720-image-fallback-not2.png");

  await sleep(3_550);
  const specialFallback = await auditNotifications();
  assert.ok(specialFallback.special.opacity > 0.5);
  assert.equal(specialFallback.special.src, "");
  assert.equal(specialFallback.special.status, "loading");
  assert.equal(specialFallback.special.disabled, false);
  assertRectInside(specialFallback.special.rect, specialFallback.viewport, "notPolina fallback");
  await screenshot("1280x720-image-fallback-notPolina.png");
  await evaluate(`document.querySelector('[data-testid="special-notification"]').click()`, true);
  await waitFor("fallback notification opens", `document.querySelector('[data-testid="s02-scene"]')?.getAttribute('data-special-opened') === 'true'`);
  await screenshot("1280x720-image-fallback-open.png");
  fallbackReport = {
    viewport: viewport.label,
    not1: "generic fallback",
    not2: "generic fallback",
    notPolina: "interactive special fallback",
  };
}

const relevantErrors = browserErrors.filter((message) =>
  !message.includes("favicon.ico")
  && message !== "Failed to load resource: the server responded with a status of 404 (Not Found)",
);
assert.deepEqual(relevantErrors, []);
await fs.writeFile(
  path.join(artifactDirectory, fallbackOnly ? "fallback-audit.json" : "audit.json"),
  `${JSON.stringify({ ok: true, report, fallbackReport }, null, 2)}\n`,
);
socket.close();
console.log(JSON.stringify({ ok: true, frames: viewports.length * 5 + (fallbackReport ? 4 : 0), artifacts: artifactDirectory, report, fallbackReport }, null, 2));
