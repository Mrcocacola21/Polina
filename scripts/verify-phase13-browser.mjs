import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const endpoint = process.env.SOULBOUND_CDP ?? "http://127.0.0.1:9224";
const appUrl = process.env.SOULBOUND_URL ?? "http://localhost:3000/?debug=1&soulSandbox=1&requiemSync=1";
const artifactDirectory = path.resolve(".next", "phase13-browser");
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
  if (message.method === "Log.entryAdded" && ["error", "warning"].includes(message.params.entry.level)) {
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
  console.error(await snapshot());
  console.error(browserErrors);
  throw new Error(`Timed out waiting for ${label}.`);
}

async function screenshot(filename) {
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await fs.writeFile(path.join(artifactDirectory, filename), Buffer.from(result.data, "base64"));
}

async function snapshot() {
  return evaluate(`(() => {
    const director = document.querySelector('[data-testid="scene-director"]');
    const silence = document.querySelector('[data-testid="silence-scene"]');
    const final = document.querySelector('[data-testid="final-scene"]');
    const visibleSilence = [...document.querySelectorAll('[data-testid="silence-scene"] p')]
      .find((node) => Number(getComputedStyle(node).opacity) > .35)?.textContent?.trim() ?? '';
    const question = final?.querySelector('p')?.textContent?.trim() ?? '';
    const finalParagraphs = final ? [...final.querySelectorAll('p')].map((node) => node.textContent?.trim() ?? '') : [];
    const media = final ? [...final.querySelectorAll('[data-media-status]')].map((node) => node.getAttribute('data-media-status')) : [];
    const black = document.querySelector('[data-absolute-black]');
    const heart = final?.querySelector('[class*="heartComposition"]')?.getBoundingClientRect();
    const questionRect = final?.querySelector('[class*="question"]')?.getBoundingClientRect();
    return {
      scene: director?.getAttribute('data-scene-id'),
      phase: director?.getAttribute('data-scene-phase'),
      runId: director?.getAttribute('data-run-id'),
      silenceBeat: silence?.getAttribute('data-scene-beat'),
      visibleSilence,
      finalBeat: final?.getAttribute('data-scene-beat'),
      questionStep: final?.getAttribute('data-question-step'),
      terminal: final?.getAttribute('data-terminal'),
      streams: final?.getAttribute('data-merge-streams-active'),
      question,
      finalParagraphs,
      media,
      black: black?.getAttribute('data-absolute-black'),
      cursor: document.querySelector('[data-cursor-mode]')?.getAttribute('data-cursor-mode'),
      gate: document.querySelector('[data-testid="audio-cinematic-silence"]')?.textContent?.trim() ?? document.querySelector('[data-testid="collection-cinematic-silence"]')?.textContent?.trim(),
      music: document.querySelector('[data-testid="audio-music-state"]')?.textContent?.trim() ?? document.querySelector('[data-testid="collection-music-state"]')?.textContent?.trim(),
      activeAudio: document.querySelector('[data-testid="audio-active-counts"]')?.textContent?.trim() ?? ('A ' + (document.querySelector('[data-testid="collection-ambient-active"]')?.textContent?.trim() ?? '?') + ' · S ' + (document.querySelector('[data-testid="collection-audio-active"]')?.textContent?.trim() ?? '?') + ' · P ' + (document.querySelector('[data-testid="collection-procedural-active"]')?.textContent?.trim() ?? '?')),
      musicTime: document.querySelector('[data-testid="audio-music-time"]')?.textContent?.trim(),
      context: document.querySelector('[data-testid="audio-context-state"]')?.textContent?.trim() ?? document.querySelector('[data-testid="collection-audio-context"]')?.textContent?.trim(),
      hudMode: document.querySelector('[data-testid="soul-hud"]')?.getAttribute('data-hud-mode'),
      continueCount: document.querySelectorAll('[data-testid="cinematic-continue"]').length,
      finalButtons: final?.querySelectorAll('button').length ?? 0,
      canvases: document.querySelectorAll('canvas').length,
      videosPlaying: [...document.querySelectorAll('video')].filter((video) => !video.paused).length,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      heartRect: heart ? { x: heart.x, y: heart.y, width: heart.width, height: heart.height, bottom: heart.bottom } : null,
      questionRect: questionRect ? { x: questionRect.x, y: questionRect.y, width: questionRect.width, height: questionRect.height, bottom: questionRect.bottom } : null,
      viewport: { width: innerWidth, height: innerHeight },
      reducedAnimation: final ? getComputedStyle(final.querySelector('[class*="fullLayer"]')).animationName : null,
    };
  })()`);
}

const visibleLine = (text) => `(() => { const line = [...document.querySelectorAll('[data-testid="silence-scene"] p')].find((node) => node.textContent?.trim() === ${JSON.stringify(text)}); return Boolean(line && Number(getComputedStyle(line).opacity) > .65); })()`;

await fs.mkdir(artifactDirectory, { recursive: true });
await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Storage.clearDataForOrigin", { origin: new URL(appUrl).origin, storageTypes: "local_storage" });
await send("Page.navigate", { url: appUrl });
await waitFor("Soul sandbox", `Boolean(document.querySelector('[data-testid="soul-collection-sandbox"]'))`, 25_000);
await sleep(1800);
await evaluate(`(() => {
  document.querySelector('[data-testid="collection-audio-unlock"]')?.click();
  [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'SEED 10')?.click();
})()`);
await waitFor("audio context", `['running','suspended'].includes(document.querySelector('[data-testid="collection-audio-context"]')?.textContent?.trim())`, 8_000);
await waitFor("ten seeded Souls", `document.querySelector('[data-testid="collection-count"]')?.textContent?.trim() === '10 / 10'`, 8_000);
await evaluate(`(() => {
  const sandbox = document.querySelector('[data-testid="soul-collection-sandbox"]');
  if (sandbox instanceof HTMLElement) sandbox.style.display = 'none';
  const director = document.querySelector('[data-testid="scene-director"]');
  if (director instanceof HTMLElement) {
    director.style.opacity = '1';
    director.style.pointerEvents = 'auto';
    director.style.zIndex = '40';
  }
  document.querySelectorAll('nextjs-portal').forEach((node) => { if (node instanceof HTMLElement) node.style.display = 'none'; });
  window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: 'SOULS_RELEASE' } }));
})()`);

await waitFor("natural Requiem", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'REQUIEM'`, 15_000);
await waitFor("natural hard cut to SILENCE", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'SILENCE'`, 22_000);
let state = await snapshot();
assert.equal(state.black, "true");
assert.equal(state.gate, "active");
assert.equal(state.visibleSilence, "");
assert.equal(state.cursor, "HIDDEN");
assert.equal(state.hudMode, "HIDDEN");
assert.equal(state.activeAudio, "A 0 · S 0 · P 0");
assert.equal(state.music?.startsWith("none"), true);
assert.equal(state.videosPlaying, 0);
assert.equal(state.canvases, 1);
await sleep(1050);
state = await snapshot();
assert.equal(state.visibleSilence, "");
assert.equal(state.black, "true");
await screenshot("01-silence-empty-black.png");

await waitFor("first Silence line", visibleLine("если убрать доту"), 4_000);
state = await snapshot();
assert.equal(state.black, "false");
assert.equal(state.gate, "active");
assert.equal(state.activeAudio, "A 0 · S 0 · P 0");
await screenshot("02-silence-first-line.png");
await waitFor("second Silence line", visibleLine("если убрать рофлы"), 4_000);
const silenceRunId = (await snapshot()).runId;

await evaluate(`window.dispatchEvent(new Event('soulbound:debug-restart-scene'))`);
await waitFor("Silence restart", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-run-id') !== '${silenceRunId}'`);
state = await snapshot();
assert.equal(state.black, "true");
assert.equal(state.gate, "active");
assert.equal(state.visibleSilence, "");
await waitFor("restarted first line", visibleLine("если убрать доту"), 4_000);
await waitFor("restarted second line", visibleLine("если убрать рофлы"), 4_000);
await waitFor("third Silence line", visibleLine("если убрать этот сайт"), 4_000);
await waitFor("pivot Silence line", visibleLine("останется одна вещь"), 5_000);
state = await snapshot();
assert.equal(state.gate, "active");
assert.equal(state.activeAudio, "A 0 · S 0 · P 0");
await screenshot("03-silence-pivot.png");

await waitFor("invisible FINAL handoff", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'FINAL'`, 6_000);
state = await snapshot();
assert.equal(state.black, "true");
assert.equal(state.gate, "active");
assert.equal(state.question, "");
assert.equal(state.continueCount, 0);

await waitFor("Final awakening", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-question-step') === '1'`, 5_000);
await waitFor("awakening SFX", `document.querySelector('[data-testid="collection-audio-active"]')?.textContent?.trim() === '1'`, 2_000);
state = await snapshot();
assert.equal(state.gate, "open");
assert.equal(state.black, "false");
assert.equal(state.question, "Можна я");
assert.equal(state.music?.startsWith("none"), true);
await screenshot("04-final-awakening.png");

await waitFor("Final core", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-question-step') === '2'`, 5_000);
await waitFor("MUS-04", `document.querySelector('[data-testid="collection-music-state"]')?.textContent?.startsWith('HEART_AND_SOUL')`, 3_000);
state = await snapshot();
assert.equal(state.question, "Можна я буду с тобой");

await waitFor("Final merge", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-scene-beat') === 'merge'`, 5_000);
await waitFor("merge word", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-question-step') === '3'`, 3_000);
state = await snapshot();
assert.equal(state.streams, "true");
assert.equal(state.question, "Можна я буду с тобой сердцем");
await screenshot("05-final-merge.png");

const finalRunId = state.runId;
await evaluate(`window.dispatchEvent(new Event('soulbound:debug-restart-scene'))`);
await waitFor("Final restart", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-run-id') !== '${finalRunId}'`);
state = await snapshot();
assert.equal(state.black, "true");
assert.equal(state.gate, "active");
assert.equal(state.question, "");
await waitFor("restarted Final stable", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-terminal') === 'true'`, 20_000);
state = await snapshot();
assert.equal(state.question, "Можна я буду с тобой сердцем и душой?");
assert.deepEqual(state.finalParagraphs, ["Можна я буду с тобой сердцем и душой?", "го встр типа"]);
assert.equal(state.music?.startsWith("HEART_AND_SOUL"), true);
assert.equal(state.music?.includes("decks 1"), true);
assert.equal(state.activeAudio, "A 0 · S 0 · P 0");
assert.equal(state.continueCount, 0);
assert.equal(state.finalButtons, 0);
assert.equal(state.media.length, 6);
assert.equal(state.media.every((status) => status === "ready"), true);
assert.equal(state.cursor, "DIMMED");
assert.equal(state.hudMode, "HIDDEN");
assert.equal(state.canvases, 1);
assert.equal(state.videosPlaying, 0);
await screenshot("06-final-stable-desktop.png");

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await sleep(500);
state = await snapshot();
assert.ok(state.heartRect.x >= 0 && state.heartRect.bottom <= state.viewport.height);
assert.ok(state.questionRect.x >= 0 && state.questionRect.bottom <= state.viewport.height);
assert.ok(state.heartRect.bottom < state.questionRect.y);
await screenshot("07-final-stable-mobile.png");

await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
await evaluate(`window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: 'SILENCE' } }))`);
await waitFor("direct SILENCE jump", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'SILENCE'`);
state = await snapshot();
assert.equal(state.black, "true");
assert.equal(state.gate, "active");
await evaluate(`window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: 'S01' } }))`);
await waitFor("jump out of SILENCE", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'S01'`);
state = await snapshot();
assert.equal(state.black, "false");
assert.equal(state.gate, "open");
await evaluate(`window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: 'FINAL' } }))`);
await waitFor("direct FINAL jump", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'FINAL'`);
state = await snapshot();
assert.equal(state.black, "true");
assert.equal(state.gate, "active");
await waitFor("direct Final awakening", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-question-step') === '1'`, 5_000);
await evaluate(`window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: 'S01' } }))`);
await waitFor("jump out of FINAL", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'S01'`);
state = await snapshot();
assert.equal(state.black, "false");
assert.equal(state.gate, "open");
await evaluate(`window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: 'FINAL' } }))`);
await waitFor("reduced-motion Final stable", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-terminal') === 'true'`, 20_000);
await waitFor("reduced-motion Final stable", `document.querySelector('[data-testid="final-scene"]')?.getAttribute('data-terminal') === 'true'`, 20_000);
state = await snapshot();
assert.equal(state.reducedAnimation, "none");
assert.equal(state.question, "Можна я буду с тобой сердцем и душой?");
assert.equal(state.music?.includes("decks 1"), true);

const idleRunId = state.runId;
const idleMusic = state.music;
await sleep(idleMilliseconds);
state = await snapshot();
assert.equal(state.runId, idleRunId);
assert.equal(state.scene, "FINAL");
assert.equal(state.terminal, "true");
assert.equal(state.music, idleMusic);
assert.equal(state.activeAudio, "A 0 · S 0 · P 0");
assert.equal(state.continueCount, 0);
assert.equal(state.finalButtons, 2);
assert.equal(state.canvases, 1);

const seriousErrors = browserErrors.filter((message) =>
  !message.includes("favicon.ico") &&
  !message.includes("/_next/hmr") &&
  !message.includes("Failed to load resource: the server responded with a status of 404"),
);
assert.deepEqual(seriousErrors, []);
console.log(JSON.stringify({ ok: true, state, browserErrors: seriousErrors, artifacts: artifactDirectory }, null, 2));
socket.close();
