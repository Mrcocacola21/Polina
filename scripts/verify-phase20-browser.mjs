import assert from "node:assert/strict";
import process from "node:process";

const endpoint = process.env.SOULBOUND_CDP ?? "http://127.0.0.1:9222";
const origin = process.env.SOULBOUND_ORIGIN ?? "http://localhost:3000";
const tabs = await fetch(`${endpoint}/json/list`).then((response) => response.json());
const page = tabs.find((tab) => tab.type === "page" && tab.url === "about:blank") ?? tabs.find((tab) => tab.type === "page");
if (!page?.webSocketDebuggerUrl) throw new Error("No Chromium page target is available.");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let id = 0;
const pending = new Map();
const browserErrors = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") browserErrors.push(message.params.exceptionDetails.text);
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(message.error.message));
  else waiter.resolve(message.result);
});

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const callId = ++id;
  pending.set(callId, { resolve, reject });
  socket.send(JSON.stringify({ id: callId, method, params }));
});
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
const waitFor = async (label, expression, timeout = 20_000) => {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error(`Timed out waiting for ${label}.`);
};
const clickButton = async (label) => {
  const count = await evaluate(`[...document.querySelectorAll('[data-testid="failure-lab"] button')].filter((button) => button.textContent?.trim() === ${JSON.stringify(label)}).length`);
  assert.equal(count, 1, `Expected exactly one Failure Lab button named ${label}`);
  await evaluate(`[...document.querySelectorAll('[data-testid="failure-lab"] button')].find((button) => button.textContent?.trim() === ${JSON.stringify(label)}).click()`);
};
const labValue = (term) => `(() => { const row = [...document.querySelectorAll('[data-testid="failure-lab"] dl > div')].find((item) => item.querySelector('dt')?.textContent === '${term}'); return row?.querySelector('dd')?.textContent?.trim(); })()`;

await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await send("Page.navigate", { url: `${origin}/?phase20Reset=1` });
await waitFor("reset shell", `Boolean(document.querySelector('[data-testid="scene-director"]'))`, 40_000);
await evaluate(`sessionStorage.clear(); localStorage.removeItem('soulbound.answer.v1'); localStorage.removeItem('soulbound.audio.v1')`);
await send("Page.navigate", { url: `${origin}/?debug=1&failureLab=1` });
await waitFor("Failure Lab", `Boolean(document.querySelector('[data-testid="failure-lab"]'))`, 40_000);

const initialQuality = await evaluate(`document.documentElement.dataset.visualQuality`);
await clickButton("REDUCED");
await waitFor("reduced motion override", `document.documentElement.dataset.motionMode === 'REDUCED'`);
assert.equal(await evaluate(`document.documentElement.dataset.visualQuality`), initialQuality, "motion preference must not rewrite adaptive quality");

await clickButton("MUTE");
await waitFor("persisted mute", `JSON.parse(localStorage.getItem('soulbound.audio.v1'))?.muted === true`);
assert.equal(await evaluate(labValue("mute")), "true");

await clickButton("NO AUDIO");
await waitFor("audio unavailable", `${labValue("audio")} === 'UNAVAILABLE'`);

await clickButton("NO WEBGL");
await waitFor("DOM WebGL fallback", `Boolean(document.querySelector('[data-testid="webgl-dom-fallback"]')) && document.querySelectorAll('canvas').length === 0`);

await clickButton("FAIL VIDEO");
await evaluate(`window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: 'S07' } }))`);
await waitFor("S07", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'S07'`);
await waitFor("video fallback", `Boolean(document.querySelector('[data-media-status] [data-fallback-kind]'))`);

await clickButton("SET PRE_FINAL");
await waitFor("recovery diagnostic", `${labValue("recovery")} === 'PRE_FINAL'`);
assert.equal(JSON.parse(await evaluate(`sessionStorage.getItem('soulbound.recovery.v1')`)).checkpoint, "PRE_FINAL");

await clickButton("RESET");
await waitFor("motion reset", `document.documentElement.dataset.motionMode === 'FULL'`);
await waitFor("WebGL restored", `document.querySelectorAll('canvas').length === 1`);
await clickButton("CLEAR RECOVERY");
await waitFor("recovery cleared", `${labValue("recovery")} === 'none'`);

await evaluate(`window.dispatchEvent(new CustomEvent('soulbound:debug-jump-scene', { detail: { sceneId: 'S09' } }))`);
await waitFor("S09 visibility fixture", `document.querySelector('[data-testid="scene-director"]')?.getAttribute('data-scene-id') === 'S09' && Boolean(document.querySelector('video[data-soulbound-video]'))`);
const backgroundTarget = await send("Target.createTarget", { url: "about:blank" });
await send("Target.activateTarget", { targetId: backgroundTarget.targetId });
await waitFor("hidden lifecycle", `document.visibilityState === 'hidden' && document.documentElement.dataset.visibility === 'hidden'`);
assert.equal(await evaluate(`[...document.querySelectorAll('video[data-soulbound-video]')].every((video) => video.paused)`), true, "owned videos must pause while hidden");
await send("Target.activateTarget", { targetId: page.id });
await waitFor("visible lifecycle", `document.visibilityState === 'visible' && document.documentElement.dataset.visibility === 'visible'`);
await send("Target.closeTarget", { targetId: backgroundTarget.targetId });

assert.deepEqual(browserErrors, []);
console.log(JSON.stringify({
  ok: true,
  viewport: { width: 390, height: 844, dpr: 3 },
  initialQuality,
  checks: ["reduced-motion", "mute-persistence", "audio-unavailable", "webgl-fallback", "video-fallback", "recovery", "visibility-lifecycle"],
}, null, 2));
socket.close();
