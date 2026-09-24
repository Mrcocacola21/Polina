import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const endpoint = process.env.SOULBOUND_CDP ?? "http://127.0.0.1:9222";
const appUrl = process.env.SOULBOUND_URL ?? "http://127.0.0.1:3000/?debug=1&soulSandbox=1";
const artifactDirectory = path.resolve(".next", "phase11-browser");
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const tabs = await fetch(`${endpoint}/json/list`).then((response) => response.json());
const page = tabs.find((tab) => tab.type === "page");
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
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(label, expression, timeout = 55_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await sleep(180);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function screenshot(filename) {
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await fs.writeFile(path.join(artifactDirectory, filename), Buffer.from(result.data, "base64"));
}

async function sceneSnapshot() {
  return evaluate(`(() => {
    const director = document.querySelector('[data-testid="scene-director"]');
    const scene = document.querySelector('[data-testid="s10-scene"], [data-testid="pre-final-scene"]');
    const hud = document.querySelector('[data-testid="soul-hud"]');
    const cursor = document.querySelector('[data-cursor-mode]');
    return {
      id: director?.getAttribute('data-scene-id'),
      phase: director?.getAttribute('data-scene-phase'),
      runId: director?.getAttribute('data-run-id'),
      beat: scene?.getAttribute('data-scene-beat'),
      collection: scene?.getAttribute('data-collection-status'),
      music: scene?.getAttribute('data-music-state'),
      count: hud?.querySelector('[data-testid="soul-count"]')?.textContent?.trim(),
      hudMode: hud?.getAttribute('data-hud-mode'),
      cursor: cursor?.getAttribute('data-cursor-mode'),
      s10: Boolean(document.querySelector('[data-testid="s10-scene"]')),
      preFinal: Boolean(document.querySelector('[data-testid="pre-final-scene"]')),
      continueVisible: Boolean(document.querySelector('[data-testid="cinematic-continue"]')),
      released: hud?.getAttribute('data-release-state'),
      activeSfx: document.querySelector('[data-testid="collection-audio-active"]')?.textContent?.trim(),
      activeProcedural: document.querySelector('[data-testid="collection-procedural-active"]')?.textContent?.trim(),
      visualEffects: document.querySelector('[data-testid="collection-visual-effects"]')?.textContent?.trim(),
      musicTone: document.querySelector('[data-testid="collection-music-tone"]')?.textContent?.trim(),
    };
  })()`);
}

await fs.mkdir(artifactDirectory, { recursive: true });
await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: appUrl });
await waitFor("Soul sandbox", `Boolean(document.querySelector('[data-testid="soul-collection-sandbox"]'))`, 25_000);
await sleep(3000);

await evaluate(`(() => {
  document.querySelector('[data-testid="collection-audio-unlock"]')?.click();
  [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'SEED 9')?.click();
  window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: 'S10' } }));
  const sandbox = document.querySelector('[data-testid="soul-collection-sandbox"]');
  if (sandbox instanceof HTMLElement) sandbox.style.display = 'none';
  const director = document.querySelector('[data-testid="scene-director"]');
  if (director instanceof HTMLElement) {
    director.style.opacity = '1';
    director.style.pointerEvents = 'auto';
    director.style.zIndex = '40';
  }
})()`);

await waitFor("S10 active", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'S10' && document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-phase') === 'active'`);
await waitFor("S10 first phrase", `document.querySelector('[data-testid="s10-scene"]')?.getAttribute('data-scene-beat') === 'first'`);
await sleep(1500);
let snapshot = await sceneSnapshot();
assert.equal(snapshot.music, "VULNERABILITY");
assert.equal(snapshot.count, "09 / 10");
assert.equal(snapshot.cursor, "DIMMED");
await screenshot("s10-early.png");

await waitFor("S10 calm beat", `document.querySelector('[data-testid="s10-scene"]')?.getAttribute('data-scene-beat') === 'calm'`);
await sleep(1500);
const calmState = await evaluate(`(() => {
  const line = document.querySelector('[data-testid="s10-scene"] p > span:nth-child(3)');
  return {
    text: line?.querySelector('span')?.textContent,
    jitter: line instanceof HTMLElement ? line.style.getPropertyValue('--jitter') : null,
    liquid: line instanceof HTMLElement ? line.style.getPropertyValue('--liquid') : null,
    edge: line instanceof HTMLElement ? line.style.getPropertyValue('--edge') : null,
  };
})()`);
assert.deepEqual(calmState, { text: "потому что люблю тебя", jitter: "0", liquid: "0", edge: "0" });
await screenshot("s10-calm.png");

const firstRunId = (await sceneSnapshot()).runId;
await evaluate(`window.dispatchEvent(new Event('soulbound:debug-restart-scene'))`);
await waitFor("S10 restarted", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-run-id') !== '${firstRunId}'`);
await waitFor("restarted S10 active", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-phase') === 'active'`);
assert.equal((await sceneSnapshot()).beat, "entry");

await evaluate(`window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: 'PRE_FINAL' } }))`);
await waitFor("PRE_FINAL after jump-away", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'PRE_FINAL' && document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-phase') === 'active'`);
snapshot = await sceneSnapshot();
assert.equal(snapshot.s10, false);
assert.equal(snapshot.preFinal, true);
assert.equal(snapshot.count, "09 / 10");
assert.equal(snapshot.hudMode, "DIMMED");
assert.equal(snapshot.activeProcedural, "0");
assert.equal(snapshot.visualEffects, "0 / 0");

await evaluate(`window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: 'S10' } }))`);
await waitFor("final S10 run", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'S10' && document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-phase') === 'active'`);
await waitFor("Soul 10 collection in progress", `document.querySelector('[data-testid="s10-scene"]')?.getAttribute('data-collection-status') === 'collecting'`, 45_000);
const collectionRunId = (await sceneSnapshot()).runId;
await evaluate(`window.dispatchEvent(new Event('soulbound:debug-restart-scene'))`);
await waitFor("S10 restarted during collection", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-run-id') !== '${collectionRunId}'`);
await waitFor("S10 active after collection cancellation", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-phase') === 'active'`);
snapshot = await sceneSnapshot();
assert.equal(snapshot.count, "09 / 10");
assert.equal(snapshot.continueVisible, false);
await waitFor("Soul 10 commit", `document.querySelector('[data-testid="s10-scene"]')?.getAttribute('data-collection-status') === 'collected'`, 50_000);
await waitFor("S10 continue", `Boolean(document.querySelector('[data-testid="cinematic-continue"]'))`, 10_000);
snapshot = await sceneSnapshot();
assert.equal(snapshot.count, "10 / 10");
assert.equal(snapshot.collection, "collected");
assert.equal(snapshot.released, "IDLE");
assert.equal(snapshot.continueVisible, true);
await screenshot("s10-complete.png");

const committedRunId = snapshot.runId;
await evaluate(`window.dispatchEvent(new Event('soulbound:debug-restart-scene'))`);
await waitFor("S10 restarted after commit", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-run-id') !== '${committedRunId}'`);
await waitFor("committed S10 replay active", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-phase') === 'active'`);
await waitFor("already-collected S10 settle", `document.querySelector('[data-testid="s10-scene"]')?.getAttribute('data-collection-status') === 'already-collected'`, 45_000);
await waitFor("already-collected S10 continue", `Boolean(document.querySelector('[data-testid="cinematic-continue"]'))`, 10_000);
snapshot = await sceneSnapshot();
assert.equal(snapshot.count, "10 / 10");
assert.equal(snapshot.collection, "already-collected");
assert.equal(snapshot.released, "IDLE");

await evaluate(`document.querySelector('[data-testid="cinematic-continue"]')?.click()`);
await waitFor("natural PRE_FINAL", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'PRE_FINAL' && document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-phase') === 'active'`);
await waitFor("PRE_FINAL long pause", `document.querySelector('[data-testid="pre-final-scene"]')?.getAttribute('data-scene-beat') === 'long-pause'`);
snapshot = await sceneSnapshot();
assert.equal(snapshot.count, "10 / 10");
assert.equal(snapshot.hudMode, "DIMMED");
assert.equal(snapshot.cursor, "HIDDEN");
assert.equal(snapshot.released, "IDLE");
assert.equal(snapshot.continueVisible, false);
assert.equal(snapshot.activeProcedural, "0");
assert.equal(snapshot.visualEffects, "0 / 0");
await screenshot("pre-final-pause.png");

const preFinalRunId = snapshot.runId;
await evaluate(`window.dispatchEvent(new Event('soulbound:debug-restart-scene'))`);
await waitFor("PRE_FINAL restarted", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-run-id') !== '${preFinalRunId}'`);
await waitFor("PRE_FINAL active after restart", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-phase') === 'active'`);
await sleep(2200);
assert.notEqual((await sceneSnapshot()).beat, "final");
await waitFor("PRE_FINAL final hold complete", `document.querySelector('[data-testid="pre-final-scene"]')?.getAttribute('data-scene-beat') === 'complete'`, 25_000);
snapshot = await sceneSnapshot();
assert.equal(snapshot.count, "10 / 10");
assert.equal(snapshot.released, "IDLE");
assert.equal(snapshot.continueVisible, true);
assert.equal(snapshot.activeProcedural, "0");
assert.equal(snapshot.visualEffects, "0 / 0");
assert.equal(await evaluate(`document.querySelector('[data-testid="pre-final-scene"] p > span:nth-child(4)')?.textContent`), "но можна я..");
await screenshot("pre-final-complete.png");

console.log(JSON.stringify({ ok: true, snapshot, artifacts: artifactDirectory }, null, 2));
socket.close();
