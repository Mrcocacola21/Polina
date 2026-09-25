import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const endpoint = process.env.SOULBOUND_CDP ?? "http://127.0.0.1:9224";
const baseUrl = process.env.SOULBOUND_URL ?? "http://localhost:3000/?debug=1&answerSandbox=1";
const artifacts = path.resolve(".next", "phase14-browser");
const idleMilliseconds = Number(process.env.SOULBOUND_IDLE_MS ?? 120_000);
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
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++sequence;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
async function evaluate(expression) {
  const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}
async function waitFor(label, expression, timeout = 25_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return Date.now() - started;
    await sleep(70);
  }
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(await snapshot())}`);
}
async function screenshot(name) {
  const image = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await fs.writeFile(path.join(artifacts, name), Buffer.from(image.data, "base64"));
}
async function hideDebugPanels() {
  await evaluate(`[
    '[data-testid="scene-debug-overlay"]',
    '[data-testid="media-debug-panel"]',
    '[data-testid="audio-debug-panel"]',
    '[data-testid="answer-debug-panel"]',
    '[data-testid="asset-diagnostics"]'
  ].forEach((selector) => document.querySelectorAll(selector).forEach((node) => { node.style.visibility = 'hidden'; }))`);
}
async function snapshot() {
  return evaluate(`(() => {
    const root = document.querySelector('[data-testid="final-scene"]');
    const buttons = root ? [...root.querySelectorAll('fieldset button')] : [];
    const date = root?.querySelector('[data-testid="final-answer-date"]');
    const heart = root?.querySelector('[class*="fullLayer"]');
    return {
      scene: document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id'),
      phase: document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-phase'),
      runId: Number(document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-run-id') ?? 0),
      beat: root?.getAttribute('data-scene-beat'),
      answer: root?.getAttribute('data-answer-state'),
      locked: root?.getAttribute('data-answer-locked'),
      visible: root?.getAttribute('data-answer-visible'),
      ending: root?.getAttribute('data-ending'),
      persistence: root?.getAttribute('data-persistence'),
      echoes: Number(root?.getAttribute('data-soul-echoes') ?? 0),
      particles: Number(root?.getAttribute('data-ending-particles') ?? 0),
      cueFires: Number(root?.getAttribute('data-yes-cue-fires') ?? 0),
      labels: buttons.map((button) => button.textContent?.trim()),
      disabled: buttons.map((button) => button.disabled),
      date: date?.textContent?.trim() ?? '',
      question: root?.querySelector('[class*="question"]')?.textContent?.trim() ?? '',
      tag: root?.querySelector('[class*="tag"]')?.textContent?.trim() ?? '',
      heartOpacity: heart ? Number(getComputedStyle(heart).opacity) : 0,
      continueCount: document.querySelectorAll('[data-testid="cinematic-continue"]').length,
      canvases: document.querySelectorAll('canvas').length,
      music: document.querySelector('[data-testid="audio-music-state"]')?.textContent?.trim(),
      musicTime: document.querySelector('[data-testid="audio-music-time"]')?.textContent?.trim(),
      musicTone: document.querySelector('[data-testid="audio-music-tone"]')?.textContent?.trim(),
      activeAudio: document.querySelector('[data-testid="audio-active-counts"]')?.textContent?.trim(),
      stored: localStorage.getItem('soulbound.answer.v1'),
      focus: document.activeElement?.textContent?.trim() ?? document.activeElement?.tagName,
    };
  })()`);
}
async function jumpTo(sceneId) {
  await evaluate(`(async () => {
    const select = document.querySelector('#scene-debug-select');
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(select, ${JSON.stringify(sceneId)});
    select?.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 80));
    [...document.querySelectorAll('[data-testid="scene-debug-overlay"] button')]
      .find((button) => button.textContent?.trim() === 'Jump')?.click();
  })()`);
  await waitFor(sceneId, `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === ${JSON.stringify(sceneId)}`);
}
async function navigate(url, clearStorage = false) {
  await send("Page.navigate", { url });
  await waitFor("page", `Boolean(document.querySelector('[data-testid="scene-director"]'))`, 30_000);
  if (clearStorage) {
    await evaluate(`localStorage.clear(); location.reload()`);
    await waitFor("reloaded page", `Boolean(document.querySelector('[data-testid="scene-director"]'))`, 30_000);
  }
  await sleep(1_200);
  await send("Runtime.evaluate", {
    expression: `document.querySelector('[data-testid="audio-unlock"]')?.click()`,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (clearStorage) {
    await waitFor("audio unlock", `document.querySelector('[data-testid="audio-context-state"]')?.textContent?.trim() === 'running'`, 5_000);
  }
  await jumpTo("FINAL");
}

await fs.mkdir(artifacts, { recursive: true });
await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

await navigate(baseUrl, true);
await waitFor("Phase 13 stable", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-terminal') === 'true'`, 22_000);
let state = await snapshot();
assert.equal(state.question, "Можна я буду с тобой сердцем и душой?");
assert.equal(state.tag, "го встр типа");
assert.deepEqual(state.labels, []);
const revealDelay = await waitFor("simultaneous choices", `document.querySelectorAll('[data-testid="final-scene"] fieldset button').length === 2`, 4_000);
assert.ok(revealDelay >= 2_100 && revealDelay <= 3_300, `answer reveal delay was ${revealDelay}ms`);
state = await snapshot();
assert.deepEqual(state.labels, ["Да ❤️", "Подумать, но нежно"]);
assert.deepEqual(state.disabled, [false, false]);
assert.equal(state.continueCount, 0);
assert.equal(state.canvases, 1);
await sleep(900);
await hideDebugPanels();
await screenshot("01-unanswered.png");

const keyboardFocus = await evaluate(`(() => {
  const buttons = [...document.querySelectorAll('[data-testid="final-scene"] fieldset button')];
  buttons[0].focus();
  const first = document.activeElement === buttons[0];
  buttons[1].focus();
  return { first, second: document.activeElement === buttons[1] };
})()`);
assert.deepEqual(keyboardFocus, { first: true, second: true });
const musicBefore = Number((state.musicTime ?? "0").split(" ")[0]);
const atomic = await evaluate(`(() => {
  const buttons = [...document.querySelectorAll('[data-testid="final-scene"] fieldset button')];
  buttons[0].click();
  buttons[0].click();
  buttons[1].click();
  const root = document.querySelector('[data-testid="final-scene"]');
  return { answer: root?.getAttribute('data-answer-state'), locked: root?.getAttribute('data-answer-locked'), disabled: buttons.map((button) => button.disabled) };
})()`);
assert.deepEqual(atomic.disabled, [true, true]);
await waitFor("YES transaction render", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-answer-state') === 'COMMITTING_YES'`);
state = await snapshot();
assert.equal(state.locked, "true");
await sleep(240);
state = await snapshot();
assert.equal(state.echoes, 0);
assert.equal(state.particles, 0);
await waitFor("ten Soul echoes", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-soul-echoes') === '10'`, 1_200);
await waitFor("YES release", `Number(document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-ending-particles')) > 0`, 1_500);
state = await snapshot();
assert.equal(state.cueFires, 1);
const normalParticleCount = state.particles;
assert.match(state.stored, /"result":"YES"/);
assert.ok(Number((state.musicTime ?? "0").split(" ")[0]) >= musicBefore);
assert.match(state.music, /HEART_AND_SOUL.*decks 1/);
await screenshot("02-yes-release.png");
await waitFor("stable YES", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-answer-state') === 'YES'`, 13_000);
state = await snapshot();
assert.equal(state.ending, "yes");
assert.match(state.date, /^\d{2}\.\d{2}\.\d{4}$/);
assert.equal(state.echoes, 0);
assert.equal(state.particles, 0);
assert.equal(state.cueFires, 2);
assert.deepEqual(state.labels, []);
assert.equal(state.continueCount, 0);
const yesDate = state.date;
await sleep(idleMilliseconds);
state = await snapshot();
assert.equal(state.cueFires, 2);
assert.equal(state.echoes, 0);
assert.equal(state.particles, 0);
assert.deepEqual(state.labels, []);
assert.match(state.music, /HEART_AND_SOUL.*decks 1/);
await screenshot("03-yes-stable.png");

await navigate(baseUrl);
await waitFor("rehydrated YES", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-answer-state') === 'YES'`, 4_000);
state = await snapshot();
assert.equal(state.date, yesDate);
assert.equal(state.cueFires, 0);
assert.equal(state.particles, 0);
assert.deepEqual(state.labels, []);
await jumpTo("S07");
assert.equal((await snapshot()).scene, "S07");
await jumpTo("FINAL");
await waitFor("YES restored after debug jump", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-answer-state') === 'YES'`, 4_000);
state = await snapshot();
assert.equal(state.date, yesDate);
assert.equal(state.particles, 0);
assert.deepEqual(state.labels, []);

await evaluate(`document.querySelector('[data-testid="answer-debug-panel"] button')?.click()`);
await waitFor("debug reset", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-answer-state') === 'UNANSWERED'`);
state = await snapshot();
assert.deepEqual(state.labels, ["Да ❤️", "Подумать, но нежно"]);
assert.equal(state.stored, null);

await evaluate(`document.querySelector('[data-testid="final-scene"] fieldset button')?.click()`);
await waitFor("restart test YES release", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-soul-echoes') === '10'`, 2_000);
const branchRunId = (await snapshot()).runId;
await evaluate(`window.dispatchEvent(new Event('soulbound:debug-restart-scene'))`);
await waitFor("YES restart cleanup", `(() => { const director = document.querySelector('[data-testid="scene-director"]'); const final = document.querySelector('[data-testid="final-scene"]'); return Number(director?.getAttribute('data-run-id')) !== ${branchRunId} && final?.getAttribute('data-answer-state') === 'YES'; })()`, 8_000);
state = await snapshot();
assert.equal(state.echoes, 0);
assert.equal(state.particles, 0);
assert.equal(state.canvases, 1);
await evaluate(`document.querySelector('[data-testid="answer-debug-panel"] button')?.click()`);
await waitFor("post-restart debug reset", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-answer-state') === 'UNANSWERED'`);

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await sleep(900);
const mobileLayout = await evaluate(`(() => {
  const buttons = [...document.querySelectorAll('[data-testid="final-scene"] fieldset button')].map((button) => button.getBoundingClientRect());
  const question = document.querySelector('[data-testid="final-scene"] [class*="question"]')?.getBoundingClientRect();
  const tag = document.querySelector('[data-testid="final-scene"] [class*="tag"]')?.getBoundingClientRect();
  return {
    buttons: buttons.map((rect) => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height })),
    questionBottom: question?.bottom ?? 0,
    tagBottom: tag?.bottom ?? 0,
  };
})()`);
assert.equal(mobileLayout.buttons.length, 2);
assert.ok(mobileLayout.buttons.every((rect) => rect.left >= 0 && rect.right <= 390 && rect.height >= 48));
assert.ok(mobileLayout.buttons[1].top > mobileLayout.buttons[0].bottom);
assert.ok(mobileLayout.questionBottom < mobileLayout.buttons[0].top);
assert.ok(mobileLayout.tagBottom < mobileLayout.buttons[0].top);
await hideDebugPanels();
await screenshot("05-unanswered-mobile.png");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
const reverseRace = await evaluate(`(() => {
  const buttons = [...document.querySelectorAll('[data-testid="final-scene"] fieldset button')];
  buttons[1].click(); buttons[0].click();
  return buttons.map((button) => button.disabled);
})()`);
assert.deepEqual(reverseRace, [true, true]);
await waitFor("THINK transaction render", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-answer-state') === 'COMMITTING_THINK'`);
await waitFor("stable THINK", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-answer-state') === 'THINK'`, 4_000);
state = await snapshot();
assert.equal(state.ending, "think");
assert.equal(state.date, "");
assert.equal(state.cueFires, 0);
assert.equal(state.echoes, 0);
assert.equal(state.particles, 0);
assert.ok(state.heartOpacity > 0.7);
assert.match(state.musicTone, /1\.00/);
assert.match(state.stored, /"result":"THINK"/);
await sleep(idleMilliseconds);
state = await snapshot();
assert.equal(state.answer, "THINK");
assert.equal(state.cueFires, 0);
assert.equal(state.echoes, 0);
assert.equal(state.particles, 0);
assert.deepEqual(state.labels, []);
assert.match(state.music, /HEART_AND_SOUL.*decks 1/);
await screenshot("04-think-stable.png");

await navigate(baseUrl);
await waitFor("rehydrated THINK", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-answer-state') === 'THINK'`, 4_000);
state = await snapshot();
assert.equal(state.date, "");
assert.deepEqual(state.labels, []);
assert.equal(state.cueFires, 0);
await jumpTo("S07");
assert.equal((await snapshot()).scene, "S07");
await jumpTo("FINAL");
await waitFor("THINK restored after debug jump", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-answer-state') === 'THINK'`, 4_000);
state = await snapshot();
assert.equal(state.date, "");
assert.equal(state.particles, 0);
assert.deepEqual(state.labels, []);

await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
await navigate(`${baseUrl}&answerStorageFailure=1`, true);
await waitFor("storage-failure choices", `document.querySelectorAll('[data-testid="final-scene"] fieldset button').length === 2`, 23_000);
await evaluate(`document.querySelector('[data-testid="final-scene"] fieldset button')?.click()`);
await waitFor("reduced-motion release", `Number(document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-ending-particles')) > 0`, 3_000);
state = await snapshot();
assert.ok(state.particles < normalParticleCount);
await waitFor("storage-failure YES", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-answer-state') === 'YES'`, 13_000);
state = await snapshot();
assert.equal(state.persistence, "unavailable");
assert.equal(state.ending, "yes");
assert.equal(state.stored, null);

const seriousErrors = browserErrors.filter((message) => !message.includes("favicon.ico") && !message.includes("Failed to load resource: the server responded with a status of 404"));
assert.deepEqual(seriousErrors, []);
console.log(JSON.stringify({ ok: true, state, artifacts }, null, 2));
socket.close();
