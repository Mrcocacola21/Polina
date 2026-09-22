import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_AUDIO_LEVELS, getAudioEngine } from "./AudioEngine";
import { AsyncDecodeCache } from "./buffers";
import { DuckRegistry } from "./ducking";
import { clampPan, clampPlaybackRate, clampVolume } from "./scheduling";
import { AudioScopeRegistry, createSceneAudioScopeId } from "./scopes";

test("technical default bus levels are stable", () => {
  assert.deepEqual(DEFAULT_AUDIO_LEVELS, {
    master: 1,
    music: 0.7,
    ambient: 0.45,
    sfx: 0.85,
    procedural: 0.5,
  });
});

test("audio engine is a locked singleton before explicit unlock", () => {
  const first = getAudioEngine();
  const second = getAudioEngine();
  assert.strictEqual(first, second);
  assert.equal(first.getSnapshot().contextState, "locked");
  assert.equal(first.getSnapshot().contextCreationCount, 0);
});

test("concurrent decoded-buffer requests share one loader promise", async () => {
  const cache = new AsyncDecodeCache<string>();
  let loads = 0;
  let release: ((value: string) => void) | undefined;
  const gate = new Promise<string>((resolve) => {
    release = resolve;
  });
  const loader = async () => {
    loads += 1;
    return gate;
  };

  const first = cache.load("voice-a", loader);
  const duplicate = cache.load("voice-a", loader);
  assert.strictEqual(first, duplicate);
  assert.equal(loads, 1);
  release?.("decoded");
  assert.equal(await first, "decoded");
  assert.equal(await cache.load("voice-a", loader), "decoded");
  assert.equal(loads, 1);
  assert.equal(cache.size, 1);
});

test("duck registry preserves the strongest overlapping attenuation", () => {
  const ducks = new DuckRegistry();
  ducks.add({ id: "a", bus: "music", to: 0.5 });
  ducks.add({ id: "b", bus: "music", to: 0.2 });
  ducks.add({ id: "c", bus: "ambient", to: 0.4 });
  assert.equal(ducks.getTarget("music"), 0.2);
  ducks.remove("a");
  assert.equal(ducks.getTarget("music"), 0.2);
  ducks.remove("b");
  assert.equal(ducks.getTarget("music"), 1);
  assert.equal(ducks.getTarget("ambient"), 0.4);
});

test("scene scope cleanup is idempotent and rejects stale registration", () => {
  const scopes = new AudioScopeRegistry();
  const scopeId = createSceneAudioScopeId("S09", 37);
  let cleanupCount = 0;
  scopes.activate(scopeId);
  scopes.register(scopeId, () => {
    cleanupCount += 1;
  });
  scopes.cleanup(scopeId);
  scopes.cleanup(scopeId);
  assert.equal(cleanupCount, 1);
  assert.equal(scopes.isActive(scopeId), false);

  scopes.register(scopeId, () => {
    cleanupCount += 1;
  });
  assert.equal(cleanupCount, 2);
});

test("control parameters clamp unsafe values", () => {
  assert.equal(clampVolume(-5), 0);
  assert.equal(clampVolume(5), 1);
  assert.equal(clampPan(-4), -1);
  assert.equal(clampPan(4), 1);
  assert.equal(clampPlaybackRate(0.1), 0.5);
  assert.equal(clampPlaybackRate(10), 2);
});
