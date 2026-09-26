import assert from "node:assert/strict";
import process from "node:process";

const endpoint = process.env.SOULBOUND_CDP ?? "http://127.0.0.1:9222";
const origin = process.env.SOULBOUND_ORIGIN ?? "http://localhost:3000";
const waitDurationMs = Number.parseInt(process.env.SOULBOUND_CLAIM_WAIT_MS ?? "5000", 10);
if (!Number.isFinite(waitDurationMs) || waitDurationMs < 0) {
  throw new Error("SOULBOUND_CLAIM_WAIT_MS must be a non-negative number.");
}
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
const clickTestId = async (testId) => {
  assert.equal(await evaluate(`document.querySelectorAll('[data-testid="${testId}"]').length`), 1);
  await evaluate(`document.querySelector('[data-testid="${testId}"]').click()`);
};

await send("Runtime.enable");
await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: `${origin}/?debug=1&soulSandbox=1` });
await waitFor("Soul sandbox", `Boolean(document.querySelector('[data-testid="soul-collection-sandbox"]'))`, 40_000);
await clickTestId("collection-audio-unlock");

const center = { x: 1280 * 0.42, y: 720 * 0.56 };
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: center.x, y: center.y });
await clickTestId("collect-point");
await waitFor("stationary-over-spawn waiting target", `document.querySelector('[data-testid="claim-stage"]')?.textContent === 'WAITING'`);
await new Promise((resolve) => setTimeout(resolve, waitDurationMs));
assert.equal(await evaluate(`document.querySelector('[data-testid="collection-count"]')?.textContent?.trim()`), "0 / 10", "waiting Soul must never auto-commit");
const targetGeometry = await evaluate(`(() => { const target = document.querySelector('[data-testid="soul-claim-target"]'); const rect = target?.getBoundingClientRect(); return rect && { width: rect.width, height: rect.height, label: target.getAttribute('aria-label') }; })()`);
assert.ok(targetGeometry.width >= 108 && targetGeometry.height >= 108, "desktop hit target must be forgiving");
assert.match(targetGeometry.label, /Soul 01/);

await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 40, y: 40 });
await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: center.x, y: center.y });
await waitFor("hover collection commit", `document.querySelector('[data-testid="collection-count"]')?.textContent?.trim() === '1 / 10'`);
for (let index = 0; index < 6; index += 1) {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: index % 2 ? center.x : 40, y: index % 2 ? center.y : 40 });
}
assert.equal(await evaluate(`document.querySelector('[data-testid="collection-count"]')?.textContent?.trim()`), "1 / 10", "pointer spam must not duplicate commit");

await clickTestId("reset-souls");
await clickTestId("collect-point");
await waitFor("keyboard waiting target", `document.querySelector('[data-testid="claim-stage"]')?.textContent === 'WAITING'`);
await evaluate(`document.querySelector('[data-testid="soul-claim-target"]').focus()`);
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
await waitFor("keyboard collection commit", `document.querySelector('[data-testid="collection-count"]')?.textContent?.trim() === '1 / 10'`);

await clickTestId("reset-souls");
await clickTestId("collect-point");
await waitFor("touch waiting target", `document.querySelector('[data-testid="claim-stage"]')?.textContent === 'WAITING'`);
await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: center.x, y: center.y, radiusX: 4, radiusY: 4, force: 1, id: 1 }] });
await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
await waitFor("touch collection commit", `document.querySelector('[data-testid="collection-count"]')?.textContent?.trim() === '1 / 10'`);

assert.deepEqual(browserErrors, []);
console.log(JSON.stringify({
  ok: true,
  waitDurationMs,
  checks: ["indefinite-wait", "spawn-under-stationary-pointer", "forgiving-hit-target", "hover-claim", "pointer-spam", "keyboard-claim", "touch-claim"],
  targetGeometry,
}, null, 2));
socket.close();
