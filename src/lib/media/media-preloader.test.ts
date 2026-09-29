import assert from "node:assert/strict";
import test from "node:test";

import type { MediaManifests } from "../assets/manifests";
import { classifyMediaPath, MediaCatalog } from "./catalog";
import { MediaPreloader } from "./media-preloader";
import { MediaPreloadError, safePlayVideo } from "./preloaders";
import type { ResolvedPreloadPlan } from "./preload-plan";
import { PreloadQueue } from "./preload-queue";
import type { MediaAsset, MediaLoaders } from "./types";

const manifests: MediaManifests = {
  visual: {
    brand: { first: "Global/first.png" },
    finale: {},
    global: { second: "Global/second.mp4" },
    requirements: {},
    sections: {},
    screens: {},
  },
  audio: {
    global: { third: "sfx/third.wav", missing: "sfx/missing.mp3" },
    prologue: {},
    scenes: {},
    requiem: {},
    final: {},
    yesEnding: {},
    music: {},
  },
};

function createFixture(loaders: MediaLoaders, concurrency = 2) {
  const catalog = new MediaCatalog(manifests.visual, manifests.audio);
  const first = catalog.getBySemanticRef("visual:brand.first");
  const second = catalog.getBySemanticRef("visual:global.second");
  const third = catalog.getBySemanticRef("audio:global.third");
  const missing = catalog.getBySemanticRef("audio:global.missing");
  const plan: ResolvedPreloadPlan = {
    BOOT_CRITICAL: [first, missing],
    AFTER_OPEN_SOUL: [first, second],
    DURING_S03: [third],
    DURING_S07: [second, third],
    BEFORE_REQUIEM: [],
    BEFORE_FINAL: [],
  };

  return {
    assets: { first, second, third, missing },
    preloader: new MediaPreloader(catalog, plan, { concurrency, loaders }),
  };
}

function uniformLoaders(loader: (asset: MediaAsset) => Promise<void>): MediaLoaders {
  return { image: loader, video: loader, audio: loader };
}

test("OGG notification sounds use the decoded audio pipeline", () => {
  assert.equal(classifyMediaPath("sfx/notPolinaSound.ogg"), "audio");
});

test("concurrent requests share one promise and one underlying load", async () => {
  let calls = 0;
  let release: (() => void) | undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fixture = createFixture(
    uniformLoaders(async () => {
      calls += 1;
      await pending;
    }),
  );

  const first = fixture.preloader.preload(fixture.assets.first);
  const duplicate = fixture.preloader.preload(fixture.assets.first);
  assert.strictEqual(duplicate, first);
  assert.equal(calls, 1);
  release?.();
  assert.equal((await first).status, "ready");
  assert.equal(calls, 1);
});

test("a requested group is idempotent and ready assets are reused", async () => {
  const calls = new Map<string, number>();
  const fixture = createFixture(
    uniformLoaders(async (asset) => {
      calls.set(asset.id, (calls.get(asset.id) ?? 0) + 1);
    }),
  );

  const first = fixture.preloader.preloadGroup("AFTER_OPEN_SOUL");
  const duplicate = fixture.preloader.preloadGroup("AFTER_OPEN_SOUL");
  assert.strictEqual(duplicate, first);
  assert.equal((await first).state, "ready");
  assert.equal(calls.get(fixture.assets.first.id), 1);
  assert.equal(calls.get(fixture.assets.second.id), 1);

  const cached = await fixture.preloader.preload(fixture.assets.first);
  assert.equal(cached.status, "ready");
  assert.equal(calls.get(fixture.assets.first.id), 1);
});

test("failures settle group progress instead of hanging", async () => {
  const fixture = createFixture(
    uniformLoaders(async (asset) => {
      if (asset.relativePath === "sfx/missing.mp3") {
        throw new MediaPreloadError("controlled failure", { retryable: false, statusCode: 404 });
      }
    }),
  );

  const progress = await fixture.preloader.preloadGroup("BOOT_CRITICAL");
  assert.deepEqual(
    {
      state: progress.state,
      total: progress.total,
      completed: progress.completed,
      ready: progress.ready,
      failed: progress.failed,
      percentage: progress.percentage,
    },
    {
      state: "ready-with-errors",
      total: 2,
      completed: 2,
      ready: 1,
      failed: 1,
      percentage: 100,
    },
  );
});

test("manual retry retries transient failures but not a 404", async () => {
  const attempts = new Map<string, number>();
  const fixture = createFixture(
    uniformLoaders(async (asset) => {
      const attempt = (attempts.get(asset.id) ?? 0) + 1;
      attempts.set(asset.id, attempt);
      if (asset.relativePath === "sfx/third.wav" && attempt === 1) {
        throw new MediaPreloadError("transient", { retryable: true, statusCode: 503 });
      }
      if (asset.relativePath === "sfx/missing.mp3") {
        throw new MediaPreloadError("not found", { retryable: false, statusCode: 404 });
      }
    }),
  );

  assert.equal((await fixture.preloader.preload(fixture.assets.third)).status, "failed");
  assert.equal((await fixture.preloader.retry(fixture.assets.third)).status, "ready");
  assert.equal(attempts.get(fixture.assets.third.id), 2);

  assert.equal((await fixture.preloader.preload(fixture.assets.missing)).status, "failed");
  assert.equal((await fixture.preloader.retry(fixture.assets.missing)).status, "failed");
  assert.equal(attempts.get(fixture.assets.missing.id), 1);
});

test("queue enforces concurrency and prioritizes queued work", async () => {
  const queue = new PreloadQueue(1);
  const order: string[] = [];
  let releaseFirst: (() => void) | undefined;
  const firstGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const first = queue.enqueue(async () => {
    order.push("first");
    await firstGate;
  }, "background");
  const background = queue.enqueue(async () => {
    order.push("background");
  }, "background");
  const critical = queue.enqueue(async () => {
    order.push("critical");
  }, "critical");

  assert.deepEqual(queue.getSnapshot(), { queued: 2, active: 1, concurrency: 1 });
  releaseFirst?.();
  await Promise.all([first, background, critical]);
  assert.deepEqual(order, ["first", "critical", "background"]);
});

test("safePlayVideo turns play rejection into a result", async () => {
  const rejection = new Error("autoplay denied");
  const result = await safePlayVideo({ play: () => Promise.reject(rejection) });
  assert.deepEqual(result, { played: false, error: rejection });
});
