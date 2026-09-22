# SOULBOUND / Requiem of Feelings

Current roadmap status:

- Phase 0 — complete: production-buildable application and validated asset foundation.
- Phase 1 — complete: cinematic state machine, SceneDirector, lifecycle runtime, placeholder progression, and development scene controls.
- Phase 2 — complete: progressive asset preloading, media cache, readiness diagnostics, and safe image/video presentation primitives.
- Phase 3 — complete: native Web Audio mixer, semantic music, lazy SFX decoding, ambience, ducking, procedural sound, and scene audio scopes.
- Phase 4 — complete: persistent WebGL visual root, reusable Soul and particle runtimes, global FX, cursor/parallax, transitions, and scoped cleanup.
- Phase 5 — complete: persistent ten-slot Soul HUD, transactional collection ritual, scene-run cancellation, and Requiem release handoff.

Real cinematic scenes, Requiem choreography, Final Heart, and final sound choreography are intentionally not implemented yet.

## Commands

```bash
npm install
npm run dev
npm run validate:assets
npm run validate:preload
npm run validate:audio
npm run validate:visuals
npm run validate:souls
npm run test:cinematic
npm run test:media
npm run test:audio
npm run test:souls
npm run lint
npm run typecheck
npm run build
npm run start
```

Open `http://localhost:3000` to traverse the placeholder cinematic timeline. In development only, `http://localhost:3000/?debug=1` displays the existing diagnostics. Open `http://localhost:3000/?debug=1&visualSandbox=1` for the Phase 4 Visual Sandbox.

Open `http://localhost:3000/?debug=1&soulSandbox=1` for the Phase 5 Soul Collection Sandbox.

## Soul collection

One authoritative registry maps `S01–S10` to `SOUL_01–SOUL_10` and slot indices 1–10. `SoulCollectionRuntime` lives above the keyed scene subtree; its count is always derived from slot states rather than stored separately. Slots transition through `EMPTY → COLLECTING → COLLECTED`, with `RELEASED` reserved for the later Requiem handoff.

NORMAL, SILENT, and DEEP rituals share the same high-level pipeline: temporary grapheme-safe text fragments or a source point, Phase 4 particles, a Phase 4 Soul, curved trail flight to the measured DOM HUD slot, HUD absorption, and then the single logical commit. SILENT suppresses every collection sound. Optional voice A/B/C, Soul Spawn, Soul Fly, ducking, and the subtle absorption tone all use the existing AudioEngine; locked or failed audio never blocks visual completion.

Transactions bind to `sceneId + runId` through `useSceneSoulCollection()`. Exit, restart, debug jump, manual cancellation, or stale completion restores the source and leaves the slot empty. Successful slots persist across scenes and support visible, dimmed, and hidden-but-measurable HUD modes.

`releaseAllForRequiem()` requires 10/10, materializes exactly ten collection-owned WebGL Souls at current HUD slot centers, and returns them without adding rings, arcs, formations, camera effects, or Requiem audio. They survive ordinary scene scope cleanup until explicitly transferred, disposed, or reset.

## Global visual runtime

`GlobalVisualRoot` is mounted outside the keyed scene-run subtree, so its one React Three Fiber Canvas and shared texture cache survive scene changes. The stable layer contract is: base (0), background (10), fog (20), WebGL (30), scene DOM (40), UI (50), global FX (60), transition cover (70), cursor (80), and debug tools (90+).

The runtime exposes GPU-oriented particle fields (one `THREE.Points` buffer per field), a controller-driven Soul primitive, screen/NDC/world coordinate helpers, fog/grain/vignette/light-leak controls, semantic cursor modes, normalized raw/smoothed pointer data, and cancellable transition masks. Soul controllers support dormant/active/charged crossfades plus spawn, breathing, charge, curved flight with a shared-texture trail, orbit, dissolve, and disposal.

Scene-owned Souls, fields, trails, and animations bind to a `VisualScope` derived from `sceneId + runId`. Restart, exit, and debug jump dispose obsolete scopes without destroying the renderer. Shared textures loaded by R3F are never disposed by an individual Soul; owned dynamic geometries are disposed when their field/trail components unmount.

Quality tiers cap DPR at 2 / 1.5 / 1 and scale particle counts to 100% / 70% / 40%. The default is MEDIUM. WebGL loss leaves the DOM composition running; masked transitions include a plain black-fade fallback.

## Cinematic engine

The canonical sequence is:

```text
PRELOADER → PROLOGUE → S01 → S02 → S03 → S04 → S05 → S06 → S07 → S08 → S09 → S10 → PRE_FINAL → SOULS_RELEASE → REQUIEM → SILENCE → FINAL
```

`SceneDirector` owns the pure reducer state machine and renders exactly one current scene. Every scene run follows `entering → active → exiting`. Scenes complete asynchronous enter/exit work through `useSceneRuntime()`. Each run receives a new `runId`, so stale callbacks are ignored.

## Progressive media loading

The media catalog is derived from the two authoritative manifests. A bounded queue runs at most five preparation operations concurrently and deduplicates both concurrent and completed requests.

- `BOOT_CRITICAL` starts at application startup and gates the PRELOADER continue control.
- `AFTER_OPEN_SOUL` starts only through the semantic `startAfterOpenSoulPrefetch()` trigger; the development panel exposes it until the real interaction exists.
- `DURING_S03` starts when S03 becomes active.
- `DURING_S07` starts when S07 becomes active.
- Development scene jumps request the target scene's dependency group before normal chronological triggers are assumed.

Image readiness means the browser load event and, where available, decode have completed. Video readiness means `loadeddata` has fired; it does not promise a full-file download. Audio readiness means a successful fetch has warmed the browser cache; no decoding or playback occurs in Phase 2.

Retries are manual and restricted to failures classified as transient. A group settles as `ready-with-errors` when a failure occurs, so loading cannot remain locked indefinitely. `npm run validate:preload` verifies all group references and reports catalog media that are intentionally unassigned.

## Audio engine

Audio is explicitly unlocked from a genuine user gesture; loading the page never creates an `AudioContext` or starts audible playback. One session-wide context owns Music, Ambient, SFX, and Procedural buses, which all flow through Master and a separate click-safe mute stage. Technical defaults are `1.0 / 0.70 / 0.45 / 0.85 / 0.50` for Master, Music, Ambient, SFX, and Procedural.

Long-form music and ambience use controlled `HTMLAudioElement` streams routed through Web Audio. Music states `NIGHT`, `MEMORIES`, `VULNERABILITY`, and `HEART_AND_SOUL` use two reusable crossfade decks. Short SFX are fetched and decoded lazily; concurrent decodes share one promise and decoded buffers are reused. The four music tracks and five 36–45 second ambience files are never stored in the decoded SFX cache.

Scene-owned ambience, SFX, duck tokens, and procedural generators bind to an audio scope derived from `sceneId + runId`. Exit, restart, and debug jump clean the obsolete scope idempotently, while persistent music and user volume/mute settings survive. In development, `?debug=1` exposes audio unlock, bus controls, music crossfades, SFX/voice/Requiem testing, ambience, overlapping duck tests, and all procedural generators.

## Assets

Runtime assets live in `public/assets` and are available at `/assets/*` URLs. The authoritative manifests are:

- `public/assets/manifest.json`
- `public/assets/audio-manifest.json`

`npm run validate:assets` checks every manifest path for duplicates and missing files without modifying either manifest.

## Foundation dependencies

- Next.js, React, and TypeScript
- GSAP
- Three.js
- React Three Fiber and Drei

No audio framework was added. Phase 3 continues to use native Web Audio and browser media elements. Phase 4 adds one persistent WebGL canvas but no final scene content or choreography.
