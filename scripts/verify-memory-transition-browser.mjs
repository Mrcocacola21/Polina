import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const endpoint = process.env.SOULBOUND_CDP ?? "http://127.0.0.1:9225";
const appUrl = process.env.SOULBOUND_URL ?? "http://localhost:3000/?debug=1&transitionLab=1";
const artifacts = path.resolve(".next", "memory-transition-browser");
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

async function waitFor(label, expression, timeout = 15_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await sleep(50);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function screenshot(filename) {
  const result = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await fs.writeFile(path.join(artifacts, filename), Buffer.from(result.data, "base64"));
}

async function snapshot() {
  return evaluate(`(() => {
    const director = document.querySelector('[data-testid="scene-director"]');
    const bridge = document.querySelector('[data-testid="transition-bridge"]');
    const s04 = document.querySelector('[data-testid="s04-scene"]');
    const phrase = s04?.querySelector('p');
    const visibleThreads = [...document.querySelectorAll('[data-testid="transition-bridge"] svg path, [data-testid="s04-scene"] svg path')]
      .filter((element) => {
        const style = getComputedStyle(element);
        const parent = element.closest('[data-hidden]');
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > .02 && parent?.getAttribute('data-hidden') !== 'true';
      });
    return {
      scene: director?.getAttribute('data-scene-id'),
      scenePhase: director?.getAttribute('data-scene-phase'),
      transitionState: bridge?.getAttribute('data-transition-state'),
      memoryPhase: bridge?.getAttribute('data-memory-phase'),
      finalMemory: bridge?.getAttribute('data-final-memory-id'),
      remainingMemories: Number(bridge?.getAttribute('data-remaining-memories') ?? -1),
      threadOwner: bridge?.getAttribute('data-thread-ownership'),
      threadOpacity: Number(bridge?.getAttribute('data-thread-opacity') ?? 0),
      musicFilter: bridge?.getAttribute('data-music-filter'),
      inherited: s04?.getAttribute('data-inherited-thread'),
      phraseOpacity: phrase ? Number(getComputedStyle(phrase).opacity) : 0,
      visibleThreads: visibleThreads.length,
      threadPath: visibleThreads[0]?.getAttribute('d') ?? '',
      s03Memories: document.querySelectorAll('[data-testid="s03-scene"] [data-memory-id]').length,
      bridgeResidue: document.querySelectorAll('[data-testid="transition-bridge"] .memoryResidue').length,
      canvases: document.querySelectorAll('canvas').length,
      heap: performance.memory?.usedJSHeapSize ?? 0,
    };
  })()`);
}

async function runTransition(label, capture = false) {
  const previousSequence = await evaluate(`Number(document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-sequence') ?? 0)`);
  const clicked = await evaluate(`(() => {
    const select = document.querySelector('[data-testid="transition-lab-pair"]');
    const run = document.querySelector('[data-testid="transition-lab-run"]');
    if (!(select instanceof HTMLSelectElement) || !(run instanceof HTMLButtonElement)) return false;
    select.value = 'S03_S04';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    run.click();
    return true;
  })()`);
  assert.equal(clicked, true);
  await waitFor(`${label} outgoing`, `document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-state') === 'outgoing' && Number(document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-sequence') ?? 0) > ${previousSequence}`, 20_000);
  await waitFor(`${label} final hold`, `document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-memory-phase') === 'FINAL_MEMORY_HOLD'`);
  const hold = await snapshot();
  assert.equal(hold.finalMemory, "together");
  assert.equal(hold.remainingMemories, 1);
  assert.equal(hold.threadOwner, "BRIDGE");
  if (capture) await screenshot(`${label}-hold.png`);
  await waitFor(`${label} dissolve`, `document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-memory-phase') === 'DISSOLVING'`);
  if (capture) await screenshot(`${label}-dissolve.png`);
  await waitFor(`${label} S04 active`, `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'S04' && document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-phase') === 'active'`);
  const beforeText = await snapshot();
  assert.equal(beforeText.inherited, "true");
  assert.equal(beforeText.phraseOpacity < 0.08, true);
  assert.equal(beforeText.threadPath.length > 20, true);
  assert.equal(beforeText.visibleThreads, 1);
  if (capture) await screenshot(`${label}-thread-only.png`);
  await waitFor(`${label} text`, `Number(getComputedStyle(document.querySelector('[data-testid="s04-scene"] p')).opacity) > .5`);
  await waitFor(`${label} bridge cleanup`, `document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-state') === 'idle'`);
  const stable = await snapshot();
  assert.equal(stable.visibleThreads, 1);
  assert.equal(stable.s03Memories, 0);
  assert.equal(stable.canvases, 1);
  if (capture) await screenshot(`${label}-text.png`);
  return { hold, beforeText, stable };
}

async function interruptTransition(phase, jumpTo = null) {
  const previousSequence = await evaluate(`Number(document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-sequence') ?? 0)`);
  const clicked = await evaluate(`(() => {
    const select = document.querySelector('[data-testid="transition-lab-pair"]');
    const run = document.querySelector('[data-testid="transition-lab-run"]');
    if (!(select instanceof HTMLSelectElement) || !(run instanceof HTMLButtonElement)) return false;
    select.value = 'S03_S04';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    run.click();
    return true;
  })()`);
  assert.equal(clicked, true);
  await waitFor(`${phase} interrupt outgoing`, `document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-state') === 'outgoing' && Number(document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-sequence') ?? 0) > ${previousSequence}`, 20_000);
  await waitFor(`${phase} interrupt phase`, `document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-memory-phase') === '${phase}'`);
  if (jumpTo) {
    await evaluate(`window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: '${jumpTo}' } }))`);
  } else {
    await evaluate(`window.dispatchEvent(new Event('soulbound:debug-restart-scene'))`);
  }
  await waitFor(`${phase} interrupt cleanup`, `document.querySelector('[data-testid="transition-bridge"]')?.getAttribute('data-transition-state') === 'idle'`);
  await waitFor(`${phase} interrupt destination`, `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === '${jumpTo ?? "S03"}' && document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-phase') === 'active'`, 20_000);
  const clean = await snapshot();
  assert.equal(clean.s03Memories, jumpTo ? 0 : 3);
  assert.equal(clean.canvases, 1);
}

await fs.mkdir(artifacts, { recursive: true });
await send("Page.enable");
await send("Runtime.enable");
await send("Log.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: appUrl });
await waitFor("Transition Lab", `Boolean(document.querySelector('[data-testid="transition-lab"]'))`, 30_000);
await waitFor("active source", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-phase') === 'active'`, 30_000);
await evaluate(`document.querySelector('[data-testid="audio-unlock"]')?.click()`);

const runs = [];
for (let index = 1; index <= 5; index += 1) runs.push(await runTransition(`1920x1080-run-${index}`, index === 1));

await send("Emulation.setDeviceMetricsOverride", { width: 2560, height: 1440, deviceScaleFactor: 1, mobile: false });
const desktop = await runTransition("2560x1440", true);

await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
const mobile = await runTransition("390x844", true);

await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
const reduced = await runTransition("390x844-reduced", true);

await evaluate(`window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: 'S04' } }))`);
await waitFor("direct S04", `document.querySelector('[data-testid="s04-scene"]')?.getAttribute('data-scene-phase') === 'active'`);
const direct = await snapshot();
assert.equal(direct.inherited, "false");

await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
for (const phase of ["MEMORIES_RECEDING", "FINAL_MEMORY_HOLD", "DISSOLVING", "THREAD_HANDOFF"]) {
  await interruptTransition(phase);
}
await interruptTransition("DISSOLVING", "S07");

const heaps = runs.map((run) => run.stable.heap).filter(Boolean);
if (heaps.length > 1) assert.equal(Math.max(...heaps) - Math.min(...heaps) < 16 * 1024 * 1024, true);
const seriousErrors = browserErrors.filter((message) =>
  !message.includes("favicon.ico") &&
  !message.includes("/_next/hmr") &&
  !message.includes("Failed to load resource: the server responded with a status of 404"),
);
assert.deepEqual(seriousErrors, []);
console.log(JSON.stringify({
  ok: true,
  repeatedRuns: runs.length,
  heapRange: heaps.length ? Math.max(...heaps) - Math.min(...heaps) : null,
  desktop: desktop.stable,
  mobile: mobile.stable,
  reduced: reduced.stable,
  direct,
  artifacts,
}, null, 2));
socket.close();
