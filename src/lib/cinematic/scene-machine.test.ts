import assert from "node:assert/strict";
import test from "node:test";

import {
  SCENE_IDS,
  SCENE_REGISTRY,
  getNextScene,
  isSceneId,
} from "./scenes";
import {
  cinematicReducer,
  INITIAL_CINEMATIC_STATE,
} from "./scene-machine";
import type { CinematicEvent, CinematicState } from "./types";

function enterScene(state: CinematicState): CinematicState {
  return cinematicReducer(state, {
    type: "ENTER_COMPLETE",
    runId: state.runId,
  });
}

function enableProgression(state: CinematicState): CinematicState {
  const withAdvance = cinematicReducer(state, {
    type: "SET_CAN_ADVANCE",
    runId: state.runId,
    value: true,
  });

  return cinematicReducer(withAdvance, {
    type: "SET_CONTINUE_VISIBLE",
    runId: withAdvance.runId,
    value: true,
  });
}

test("registry contains the exact canonical sequence", () => {
  assert.deepEqual(SCENE_IDS, [
    "PRELOADER",
    "PROLOGUE",
    "S01",
    "S02",
    "S03",
    "S04",
    "S05",
    "S06",
    "S07",
    "S08",
    "S09",
    "S10",
    "PRE_FINAL",
    "SOULS_RELEASE",
    "REQUIEM",
    "SILENCE",
    "FINAL",
  ]);
  assert.equal(SCENE_REGISTRY.length, 17);
  assert.equal(getNextScene("FINAL"), undefined);
  assert.equal(isSceneId("NOT_A_SCENE"), false);
});

test("an active scene may remain locked until interaction enables progression", () => {
  const active = enterScene(INITIAL_CINEMATIC_STATE);
  assert.equal(active.phase, "active");
  assert.equal(active.canAdvance, false);

  const lockedRequest = cinematicReducer(active, {
    type: "REQUEST_ADVANCE",
    runId: active.runId,
  });
  assert.strictEqual(lockedRequest, active);

  const visibleButLocked = cinematicReducer(active, {
    type: "SET_CONTINUE_VISIBLE",
    runId: active.runId,
    value: true,
  });
  assert.equal(visibleButLocked.continueVisible, true);
  assert.equal(visibleButLocked.canAdvance, false);

  const enabled = cinematicReducer(visibleButLocked, {
    type: "SET_CAN_ADVANCE",
    runId: active.runId,
    value: true,
  });
  assert.equal(enabled.canAdvance, true);
  assert.equal(
    cinematicReducer(enabled, {
      type: "REQUEST_ADVANCE",
      runId: enabled.runId,
    }).phase,
    "exiting",
  );
});

test("repeated advance requests cannot skip a scene", () => {
  const ready = enableProgression(enterScene(INITIAL_CINEMATIC_STATE));
  const request = { type: "REQUEST_ADVANCE", runId: ready.runId } as const;
  const exiting = cinematicReducer(ready, request);
  const repeated = cinematicReducer(exiting, request);

  assert.equal(exiting.currentSceneId, "PRELOADER");
  assert.equal(exiting.phase, "exiting");
  assert.equal(exiting.canAdvance, false);
  assert.strictEqual(repeated, exiting);

  const prologue = cinematicReducer(repeated, {
    type: "EXIT_COMPLETE",
    runId: repeated.runId,
  });
  assert.equal(prologue.currentSceneId, "PROLOGUE");
  assert.equal(prologue.phase, "entering");
});

test("stale lifecycle callbacks cannot mutate a newer run", () => {
  const ready = enableProgression(enterScene(INITIAL_CINEMATIC_STATE));
  const exiting = cinematicReducer(ready, {
    type: "REQUEST_ADVANCE",
    runId: ready.runId,
  });
  const staleRunId = exiting.runId;
  const jumped = cinematicReducer(exiting, {
    type: "JUMP_TO_SCENE",
    sceneId: "S08",
  });

  assert.equal(jumped.currentSceneId, "S08");
  assert.equal(jumped.phase, "entering");
  assert.ok(jumped.runId > staleRunId);

  const afterStaleExit = cinematicReducer(jumped, {
    type: "EXIT_COMPLETE",
    runId: staleRunId,
  });
  const afterStaleEnter = cinematicReducer(afterStaleExit, {
    type: "ENTER_COMPLETE",
    runId: staleRunId,
  });
  assert.strictEqual(afterStaleExit, jumped);
  assert.strictEqual(afterStaleEnter, jumped);
});

test("restart creates a clean run and invalid jumps are harmless", () => {
  const active = enableProgression(enterScene(INITIAL_CINEMATIC_STATE));
  const restarted = cinematicReducer(active, { type: "RESTART_CURRENT" });

  assert.equal(restarted.currentSceneId, active.currentSceneId);
  assert.equal(restarted.phase, "entering");
  assert.equal(restarted.runId, active.runId + 1);
  assert.equal(restarted.canAdvance, false);
  assert.equal(restarted.continueVisible, false);

  const invalidJump = {
    type: "JUMP_TO_SCENE",
    sceneId: "NOT_A_SCENE",
  } as unknown as CinematicEvent;
  assert.strictEqual(cinematicReducer(restarted, invalidJump), restarted);
});

test("the full timeline reaches FINAL and FINAL cannot advance", () => {
  let state = INITIAL_CINEMATIC_STATE;

  for (const [index, sceneId] of SCENE_IDS.entries()) {
    assert.equal(state.currentSceneId, sceneId);
    assert.equal(state.phase, "entering");

    state = enterScene(state);
    assert.equal(state.phase, "active");

    if (sceneId === "FINAL") {
      const forcedReady = enableProgression(state);
      const finalRequest = cinematicReducer(forcedReady, {
        type: "REQUEST_ADVANCE",
        runId: forcedReady.runId,
      });
      assert.strictEqual(finalRequest, forcedReady);
      break;
    }

    state = enableProgression(state);
    state = cinematicReducer(state, {
      type: "REQUEST_ADVANCE",
      runId: state.runId,
    });
    assert.equal(state.phase, "exiting");

    const previousRunId = state.runId;
    state = cinematicReducer(state, {
      type: "EXIT_COMPLETE",
      runId: state.runId,
    });
    assert.equal(state.currentSceneId, SCENE_IDS[index + 1]);
    assert.equal(state.runId, previousRunId + 1);
    assert.equal(state.canAdvance, false);
    assert.equal(state.continueVisible, false);
  }

  assert.equal(state.currentSceneId, "FINAL");
});
