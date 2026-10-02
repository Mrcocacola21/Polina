# SOULBOUND / Requiem of Feelings

Current roadmap status:

- Phase 0 — complete: production-buildable application and validated asset foundation.
- Phase 1 — complete: cinematic state machine, SceneDirector, lifecycle runtime, placeholder progression, and development scene controls.
- Phase 2 — complete: progressive asset preloading, media cache, readiness diagnostics, and safe image/video presentation primitives.
- Phase 3 — complete: native Web Audio mixer, semantic music, lazy SFX decoding, ambience, ducking, procedural sound, and scene audio scopes.
- Phase 4 — complete: persistent WebGL visual root, reusable Soul and particle runtimes, global FX, cursor/parallax, transitions, and scoped cleanup.
- Phase 5 — complete: persistent ten-slot Soul HUD, transactional collection ritual, scene-run cancellation, and Requiem release handoff.
- Phases 6–11 — complete: production scenes S01–S10 and PRE_FINAL.
- Phase 12 — complete: SOULS_RELEASE, persistent ten-Soul Requiem handoff, and hard-cut choreography.
- Phase 13 — complete: cinematic SILENCE boundary and Final Heart confession.
- Phase 14 — complete: atomic YES / THINK endings and local answer persistence.
- Phase 15 — complete: typed transition choreography, persistent semantic bridges, incoming-media preparation, Transition Lab, cancellation invariants, and transition QA.
- Phase 16 — complete: full-film directing pass, centralized timing and cinematic mix, reading holds, collection-rhythm variation, semantic music gain automation, voice ducking, and uninterrupted YES/THINK production playback QA.
- Phase 17 — complete: desktop art direction, responsive cinematic typography, media/black-level integration, restrained depth and glow hierarchy, polished HUD/cursor/controls, and a visual lock for 1920×1080 and 2560×1440 at 100% zoom.
- Phase 18 — complete: mobile/touch composition and interaction adaptation.
- Phase 19 — complete: content-addressed lossless image and streamed-audio delivery, staged preloading, media lifecycle cleanup, adaptive quality, leak-cycle QA, and production performance reporting.
- Phase 20 — complete: live reduced-motion, keyboard/focus semantics, persistent global mute, WebGL/audio/media fallbacks, visibility lifecycle, safe refresh recovery, fatal recovery UI, and development Failure Lab.

## Commands

```bash
npm install
npm run dev
npm run validate:assets
npm run validate:preload
npm run validate:audio
npm run validate:visuals
npm run validate:souls
npm run validate:requiem
npm run validate:ending
npm run validate:transitions
npm run validate:directing
npm run validate:desktop
npm run test:cinematic
npm run test:media
npm run test:audio
npm run test:souls
npm run test:phase15
npm run test:phase16
npm run test:phase17
npm run test:phase17:responsive
npm run optimize:assets
npm run validate:optimized-assets
npm run validate:performance
npm run validate:accessibility
npm run validate:failures
npm run test:phase19
npm run test:phase20
npm run test:phase20:browser
npm run lint
npm run typecheck
npm run build
npm run start
```

## Production deployment

Install the locked dependency tree with `npm ci`, run the validators and tests declared in `package.json`, then run `npm run lint`, `npm run typecheck`, and `npm run build`. Production is deployed to the repository's linked Vercel project with `npx vercel --prod`; the machine-local project link lives in the ignored `.vercel/project.json` file and must be inspected before relinking or creating a project.

After deployment, verify the production URL, the PRELOADER → PROLOGUE → Open Soul path, and representative image, video, music, notification, Requiem, and Final asset URLs. Media responses must use the expected MIME type and support byte ranges where applicable.

## Desktop visual lock

Phase 17 locks the desktop art direction at 1920×1080 and 2560×1440 CSS pixels at 100% browser zoom. Later mobile, performance, and accessibility work may adapt the experience while preserving the locked desktop typography, line breaks, compositions, asset scales, grading, glow hierarchy, particle targets, camera framing, cursor, and controls.

Shared palette, typography, spacing, safe-area, and control tokens live in `src/app/globals.css`. Executable reference viewport and quality constants live in `src/lib/visuals/desktop.ts`. `npm run test:phase17:film` performs a natural production-path traversal and writes audited key-frame PNGs under `.next`; `npm run test:phase17:responsive` exercises the layered scenes at the three secondary desktop canvases in development. The complete lock rationale and QA record are in `docs/phase17-desktop-visual-lock.md`.

## Final directing and mix

Phase 16 keeps the Phase 0–15 architecture and source media intact. Production timing, internal gains, duck presets, and semantic crossfades are collected in `src/lib/cinematic/directing.ts`; user mixer values remain independent multipliers. The mix preserves a quiet opening, warmer S03–S07 body, a controlled Queen peak, a larger Requiem peak, exact digital zero through SILENCE, an intimate Final rebuild, and distinct warm YES/THINK resolutions.

The final production-like, no-debug runs measured 371.668 seconds to stable YES and 362.695 seconds to stable THINK with immediate natural interactions. Both traversed all 17 scene runs with zero browser errors, empty frames, or white frames. The detailed timing/mix sheet and QA notes are in `docs/phase16-directors-report.md`.

Open `http://localhost:3000` to traverse the placeholder cinematic timeline. In development only, `http://localhost:3000/?debug=1` displays the existing diagnostics. Open `http://localhost:3000/?debug=1&visualSandbox=1` for the Phase 4 Visual Sandbox.

Open `http://localhost:3000/?debug=1&soulSandbox=1` for the Phase 5 Soul Collection Sandbox.

Open `http://localhost:3000/?debug=1&transitionLab=1` for the development-only Phase 15 Transition Lab. It can seed the required Soul count, run every canonical boundary repeatedly, and reports run IDs, bridge/mask state, fog, music, ambience, videos, particles, cursor, HUD, and camera baseline.

Open `http://localhost:3000/?debug=1&failureLab=1` for the development-only Phase 20 Failure Lab. Accessibility behavior and practical browser assumptions are documented in `docs/accessibility.md`; media, WebGL, audio, visibility, and refresh recovery policies are documented in `docs/failure-modes.md`.

## Transition continuity

`SceneDirector` remains the sole scene lifecycle authority and still renders one production scene at a time. A persistent, pointer-transparent bridge layer carries only the outgoing semantic motif across the keyed React boundary; the incoming scene is requested from the media cache as soon as EXITING starts. Bridge state is bound to outgoing and incoming run IDs, and restart/debug jump cancels both bridge and mask state before changing scenes.

The registry in `src/lib/cinematic/transitions.ts` centralizes all canonical pair timings and handoff metadata. Scene audio scopes still own ambiences and one-shots, persistent music is not restarted at ordinary boundaries, HUD/Soul ownership remains in `SoulCollectionRuntime`, and the same ten released Soul controllers cross from SOULS_RELEASE into REQUIEM. `REQUIEM → SILENCE` is the single intentional non-interpolated boundary: absolute black, zero audio, hidden cursor/HUD, and no softened fade. `SILENCE → FINAL` retains that exact black frame until Final awakening begins.

## Soul collection

One authoritative registry maps `S01–S10` to `SOUL_01–SOUL_10` and slot indices 1–10. `SoulCollectionRuntime` lives above the keyed scene subtree; its count is always derived from slot states rather than stored separately. Slots transition through `EMPTY → COLLECTING → COLLECTED`, with `RELEASED` reserved for the later Requiem handoff.

NORMAL, SILENT, and DEEP rituals share the same high-level pipeline: temporary grapheme-safe text fragments or a source point, Phase 4 particles, a Phase 4 Soul, curved trail flight to the measured DOM HUD slot, HUD absorption, and then the single logical commit. SILENT suppresses every collection sound. Optional voice A/B/C, Soul Spawn, Soul Fly, ducking, and the subtle absorption tone all use the existing AudioEngine; locked or failed audio never blocks visual completion.

Transactions bind to `sceneId + runId` through `useSceneSoulCollection()`. Exit, restart, debug jump, manual cancellation, or stale completion restores the source and leaves the slot empty. Successful slots persist across scenes and support visible, dimmed, and hidden-but-measurable HUD modes.

`releaseAllForRequiem()` requires 10/10, materializes exactly ten collection-owned WebGL Souls at current HUD slot centers, and returns them without adding rings, arcs, formations, camera effects, or Requiem audio. They survive ordinary scene scope cleanup until explicitly transferred, disposed, or reset.

## Global visual runtime

`GlobalVisualRoot` is mounted outside the keyed scene-run subtree, so its one React Three Fiber Canvas and shared texture cache survive scene changes. The stable layer contract is: base (0), background (10), fog (20), WebGL (30), scene DOM (40), UI (50), global FX (60), transition cover (70), cursor (80), and debug tools (90+).

The runtime exposes GPU-oriented particle fields (one `THREE.Points` buffer per field), a controller-driven Soul primitive, screen/NDC/world coordinate helpers, fog/grain/vignette/light-leak controls, semantic cursor modes, normalized raw/smoothed pointer data, and cancellable transition masks. Soul controllers support dormant/active/charged crossfades plus spawn, breathing, charge, curved flight with a shared-texture trail, orbit, dissolve, and disposal.

Scene-owned Souls, fields, trails, and animations bind to a `VisualScope` derived from `sceneId + runId`. Restart, exit, and debug jump dispose obsolete scopes without destroying the renderer. Shared textures loaded by R3F are never disposed by an individual Soul; owned dynamic geometries are disposed when their field/trail components unmount.

Quality tiers cap DPR at 2 / 1.5 / 1 and scale particle counts to 100% / 70% / 40%. AUTO starts from capability hints and uses sustained frame-time hysteresis to move one tier at a time. WebGL loss leaves the DOM composition running; masked transitions include a plain black-fade fallback.

## Cinematic engine

The canonical sequence is:

```text
PRELOADER → PROLOGUE → S01 → S02 → S03 → S04 → S05 → S06 → S07 → S08 → S09 → S10 → PRE_FINAL → SOULS_RELEASE → REQUIEM → SILENCE → FINAL
```

`SceneDirector` owns the pure reducer state machine and renders exactly one current scene. Every scene run follows `entering → active → exiting`. Scenes complete asynchronous enter/exit work through `useSceneRuntime()`. Each run receives a new `runId`, so stale callbacks are ignored.

## Progressive media loading

The media catalog is derived from the authoritative manifests plus an optional optimized-delivery manifest. A bounded queue runs at most three preparation operations concurrently and deduplicates both concurrent and completed requests.

- `BOOT_CRITICAL` starts at application startup and gates the PRELOADER continue control.
- `AFTER_OPEN_SOUL` starts only through the semantic `startAfterOpenSoulPrefetch()` trigger; the development panel exposes it until the real interaction exists.
- `DURING_S03` starts when S03 becomes active.
- `DURING_S07` starts when S07 becomes active.
- `BEFORE_REQUIEM` starts alongside the S07 late-film look-ahead.
- `BEFORE_FINAL` starts when S09 becomes active.
- Development scene jumps request the target scene's dependency group before normal chronological triggers are assumed.

Image readiness means the browser load event and, where available, decode have completed. Video readiness means `loadeddata` has fired; it does not promise a full-file download. Short-audio readiness warms the browser cache; long-form music/ambience readiness is metadata-only so preload does not duplicate a full stream.

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

Source masters remain authoritative. Reproducible content-addressed delivery variants live in `public/assets-optimized`; unsupported formats fall back to the master URL. The complete baseline, budgets, decisions, limitations, and runtime evidence are in `docs/phase19-performance-loading-report.md`.

## Foundation dependencies

- Next.js, React, and TypeScript
- GSAP
- Three.js
- React Three Fiber and Drei

No audio framework was added. Phase 3 continues to use native Web Audio and browser media elements. Phase 4 adds one persistent WebGL canvas but no final scene content or choreography.
