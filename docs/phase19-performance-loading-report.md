# Phase 19 — Performance + Loading Report

Date: 2026-09-25. Scope: performance, loading, lifecycle, and adaptive quality only. Story, Phase 15 transitions, Phase 16 timing/mix, and Phase 17 desktop art direction remain locked.

## Result

Cold transfer to usable Open Soul fell from 51.89 MB to 17.25 MB (−66.8%). A natural PRELOADER → stable YES run fell from 203.94 MB to 72.72 MB (−64.3%). Open Soul remained 17.04 s → 16.96 s because the authored gate, rather than local network, is now limiting. The final run retained one Canvas, ended with zero video/audio DOM elements, and used 8.62 MB JS heap after forced GC. Four repeated S03 → S07 → S09 → FINAL → S03 jump cycles plateaued at 15.75–16.20 MB after GC.

## Required detailed report

1. **Existing architecture.** One persistent R3F Canvas, one AudioEngine, scene/run scopes, priority preload queue, shared textures, lazy SFX decode, streamed long-form audio, reusable music decks, and explicit GSAP/RAF cleanup existed. The actual tree has Phase 15–17 artifacts but no separately named Phase 18 validator/report.
2. **Created.** `next.config.ts`, `public/assets-optimized/**`, four Phase 19 asset/performance scripts, two browser measurement scripts, `PerformanceDebugPanel.tsx`, Phase 19 tests/config, and this report.
3. **Modified.** Asset manifest loading; media catalog/types/preloaders/plan/provider; audio cache; media/fog cleanup; visual quality/runtime/Canvas/objects; heavy-scene particle call sites; transition asset mounting; debug imports; validators; package scripts; README.
4. **Scripts.** `optimize:assets` generates content-addressed outputs. `validate:optimized-assets` verifies hashes, closed inventory, visible pixels, and AUD-REQ-05. `validate:performance` enforces structural budgets.
5. **Baseline assets.** 104 files / 189,276,063 bytes: WAV 125,935,598; PNG 51,800,578; MP4 11,066,128; MP3 383,957; JPG 85,298; JSON 4,504.
6. **Delivery assets.** Masters remain intact. Generated set is 46,347,008 bytes including manifest/mobile variants. Forty-four default variants are 42,672,589 versus 150,523,278 source bytes (−71.7%).
7. **Baseline critical transfer.** 51,892,012 bytes / 39 requests; images 18.02 MB and fetch/audio 29.39 MB dominated.
8. **Final critical transfer.** 17,249,730 CDP bytes / 37 requests; images 11.69 MB, audio 1.07 MB, video 3.97 MB, JS 0.485 MB.
9. **Full-film reduction.** Total 203.94 → 72.72 MB (−64.3%); image 37.6 → 35.11 MB (−6.6%); audio 144.2 → 26.71 MB (−81.5%); video 21.77 → 10.56 MB (−51.5%). Entries 206 → 208 because variants/range entries are separately visible.
10. **Masters.** SHA-256 validation confirms preservation; generation writes only under `public/assets-optimized`.
11. **Images.** Lossless WebP was selected where smaller. Lossy WebP was tested and rejected.
12. **AVIF.** None shipped: decode/duplication cost was not justified for locked dark gradients/transparency.
13. **WebP.** Thirty-two production PNGs across BRAND, FIN, REQ, S, and Screens gained lossless defaults.
14. **Unconverted images.** Shared Global R3F/mask PNGs stay on master URLs to avoid loading master plus catalog variant. Small JPGs remain originals to avoid lossy recompression.
15. **Resolution variants.** FIN-01A/B/C keep 4096² default variants and gain 2048² mobile variants.
16. **Personal screenshots.** Visible pixels compare byte-identically on the locked black canvas.
17. **Alpha.** Transparent outputs compare exactly after black compositing; irrelevant RGB under alpha may differ by container.
18. **Audio formats.** Four music and five ambience WAVs gained Opus/WebM streams. Short/sync-critical/Final/YES/Requiem cues remain masters.
19. **Converted WAVs.** MUS-01/02/03/04, AUD-S01-01, AUD-S03-03, AUD-S05-01, AUD-S09-01/02.
20. **Music.** 128 kbps Opus through the existing reusable dual decks; metadata-only preload.
21. **Ambience.** 96 kbps Opus, scope-owned and metadata-only preloaded.
22. **SFX.** Short important cues remain WAV and lazy-decode, preserving transients.
23. **Requiem.** AUD-REQ-05 remains the 6.000 s original MP3 with SHA-256 `2b4c713927df826d9c45d5b4643afb21f3627dd731e3e0bd6a0ad18461f5efc8`; all seven cue checks pass.
24. **Final/YES audio.** AUD-FIN-01/02/03 and AUD-YES-01/02 are untouched masters.
25. **Video baseline.** Six H.264 MP4s; five 1280×720/24 fps and Polina Circle 640²/30 fps; each carried unused audio.
26. **Video output.** REQ-04, S09-02, and Polina Circle are fast-start MP4 remuxes with exact H.264 stream copy and audio removed.
27. **Codec strategy.** H.264 MP4 remains the compatibility source; masters remain fallbacks.
28. **Preload policy.** Queue preparation waits for `loadeddata`; component preload is explicit. Staging prevents the old all-at-S07 burst.
29. **Polina video.** Resolution/frames are unchanged; only unused audio/container overhead changed.
30. **REQ-04 sync.** Video stream is copied; container-duration drift is bounded below 40 ms; Requiem audio is untouched.
31. **Groups.** BOOT_CRITICAL, AFTER_OPEN_SOUL, DURING_S03, DURING_S07, BEFORE_REQUIEM, BEFORE_FINAL.
32. **Boot contents.** Brand, persistent Soul/particle/fog/transition essentials, S01 room/Discord, prologue/S01/global sounds, MUS-01. Unused GLOBAL-09A/B left boot.
33. **Concurrency.** Five → three preparations.
34. **Priority.** Critical boot, high near-scene requests, background chronological look-ahead; queued work can still be promoted.
35. **Lazy loading.** S03 starts S06–S08; S07 starts S09/S10 and Requiem; S09 starts Final. Memory bridge/light leak assets mount only while used.
36. **Dedupe.** Concurrent and ready requests share MediaCache state/promise; tests pass.
37. **Object URLs.** None exist; therefore no revoke leak.
38. **Decode cache.** Short buffers use a 32-entry LRU with in-flight dedupe.
39. **Shared textures.** Five persistent Soul/particle textures remain R3F-cache owned.
40. **Texture ownership.** Scene code never disposes shared cache textures. Mobile FIN variants reduce three-layer decoded size from roughly 192 MiB to 48 MiB.
41. **Geometry/materials.** Owned particle/trail resources clean up on unmount. Fixed-capacity particle buffers vary draw range instead of reallocating.
42. **Render targets.** No custom render targets found or added.
43. **GSAP.** Scoped cancellation remains; no orphan production tween was found.
44. **RAF.** Production loops clean up; the single persistent R3F loop is intentional.
45. **Listeners.** WebGL context listeners now explicitly remove. Existing pointer/media/debug listeners retain cleanup.
46. **Video cleanup.** Unmount pauses, resets where requested, removes `src`, and calls `load()`; fog follows the same rule.
47. **Audio handles.** Scene scopes remain idempotent; music decks intentionally persist. Stable Final has zero audio DOM elements.
48. **Per-frame allocation.** Removed `trail.slice(-64)` and new orbit arrays. Particle quality changes reuse buffers.
49. **Shader hitches.** No reproducible new compile hitch observed.
50. **Prewarm.** None added; moving unmeasured work into startup was rejected.
51. **Baseline resources.** Exact GPU counters unavailable headlessly. Observable: one Canvas, zero videos at stable Final, roughly 9–13 MB heap after GC.
52. **Final resources.** One Canvas, zero Final video/audio elements, 8.62 MB heap, 431 DOM nodes, 331 CDP-reported listeners.
53. **Baseline memory.** Roughly 9–13 MB after GC without monotonic JS-heap rise; GPU memory unavailable.
54. **Final memory.** 7.07 MB after cold Prologue GC and 8.62 MB after stable YES GC.
55. **S03 leak cycle.** Four cycles returned to S03 with one Canvas and plateaued heap.
56. **S07 leak cycle.** Four cycles; at most one live video.
57. **S09 leak cycle.** Four cycles; no obsolete S09 video retained.
58. **Requiem leak result.** Natural Requiem completed with one Canvas; existing restart/cue-latch tests pass.
59. **Final/YES leak result.** Final joined four jump cycles; natural YES completed with no terminal DOM media.
60. **Expected plateau.** Renderer, R3F textures, AudioContext/decks, cache metadata, and at most 32 decoded SFX persist intentionally.
61. **Limits.** Reliable GPU-process memory and exact Three counters were unavailable. Audio was structurally/timing validated, not human-listened here.
62. **HIGH.** DPR ≤2, particles 1.0, complete authored effects/video.
63. **MEDIUM.** DPR ≤1.5, particles 0.7, identical choreography/assets/effects.
64. **LOW.** DPR ≤1, particles 0.4, identical choreography/assets/effects.
65. **DPR.** 2 / 1.5 / 1.
66. **Particles.** 100% / 70% / 40%.
67. **Heavy bases.** Requiem 440/burst 520; S09 78 (28 reduced-motion); S10 18. Runtime applies tier once, removing previous double scaling.
68. **Mobile.** 2048² FIN layers, LOW start on narrow ≥2.5 DPR/coarse-low-memory devices, capped DPR/particles, unchanged semantic effects.
69. **AUTO inputs.** CSS dimensions, DPR, coarse pointer, optional `deviceMemory`, and `hardwareConcurrency`.
70. **Frame metric.** 8% EMA of R3F delta; hidden/non-positive/>250 ms samples are ignored.
71. **Downgrade.** EMA >20.5 ms for 2 s; one step at a time.
72. **Upgrade.** EMA <15.5 ms for 8 s; one step at a time.
73. **Anti-oscillation.** Separate sustained windows, 5 s cooldown, one-step moves, and dead band.
74. **Smoothing.** Particle count reaches target over about 2.5 s using fixed buffers.
75. **Perf panel.** Dev `?debug=1&perf=1` exposes tier controls, EMA/FPS, DPR, particles/systems/Souls, WebGL/viewport/scopes, queue/cache, audio, and DOM media.
76. **Debug bundle.** Debug panels/labs/sandboxes are dynamic imports and absent from production UI.
77. **Bundle.** Static JS 1,857,560/10 files → 1,886,529/20 (+1.6%, including lazy chunks); largest chunk 1,291,450 → 739,583 (−42.7%). Cold initial JS stays ~0.485 MB. CSS 116,441 → 116,388.
78. **Cold.** Open Soul 17.04 → 16.96 s; 51.89 → 17.25 MB; no post-change timeout.
79. **Warm.** 35 requests transferred only 5,698 CDP bytes (Resource Timing 1,690); Open Soul 17.09 s because authored timing dominates.
80. **Slow network.** No throttled full film is claimed. Metadata-only audio and staged look-ahead reduce contention structurally; real throttled acceptance remains useful.
81. **1920×1080.** Natural production YES run passed 28 frames, no serious errors, one Canvas, no overflow.
82. **2560×1440.** HIGH S07/S09 audits passed; visual inspection preserved composition/gradation and no overflow.
83. **Mobile AUTO.** 390×844/DPR3 starts LOW; forced LOW/HIGH/AUTO pass. No standalone Phase 18 suite exists in this tree.
84. **S03.** Natural memory flight passed; memory bridge images no longer mount at startup.
85. **S07.** Portrait/rating passed at 1920 and 2560; late preload is split.
86. **S08.** First/second/settle Queen frames passed naturally.
87. **S09.** Pre/half/completed hold and 2560 frame passed; rain H.264 frames unchanged.
88. **Requiem.** Radial/hero passed; arcs/rings/Souls retained, tiering single-applied, cue source unchanged.
89. **Final.** Question/answers passed; desktop retains 4096², mobile selects 2048² FIN layers.
90. **YES.** Stable YES completed and persisted; semantics/audio masters unchanged.
91. **Waveform sync.** Unchanged hash/duration plus passing seven-cue validator/tests.
92. **Hard cut.** REQUIEM → SILENCE remains zero-duration; natural black-boundary assertions pass.
93. **Phase 16 mix.** Gains/crossfades/timings unchanged; validator/tests pass. Perceptual listening was unavailable.
94. **Phase 17 lock.** Unit tests, natural 1920 film, and 2560 HIGH frames pass; visible lossless pixels are exact.
95. **Mobile composition.** No layout redesign. Representative mobile quality/jump checks pass; no Phase 18 files exist to validate separately.
96. **Commands.** All repo validators; cinematic/media/audio/souls and Phase 6–17/19 unit suites; lint; typecheck; build; natural film; responsive checks; and Phase 19 browser cycles passed. Phase 18 command is absent.
97. **Production runtime.** `next build`/`next start` and natural production traversal to stable YES pass without serious console errors.
98. **Remaining limits.** Authored gate dominates startup; some shared Global PNGs intentionally remain masters; exact GPU memory/real-device thermals and throttled full film remain device QA.
99. **Rejected.** Lossy WebP, AVIF duplication, desktop hero downscale, Requiem transcode, effect removal, video-to-still substitution, indiscriminate texture disposal.
100. **Scope boundary.** Phase 20 accessibility/failure-mode and Phase 21 release-candidate work were not implemented.
101. **Acceptance.** NO AVOIDABLE JANK OBSERVED IN THE TESTED EMOTIONALLY CRITICAL SCENES.

## Reproduce

```bash
npm run optimize:assets
npm run validate:optimized-assets
npm run validate:performance
npm run test:phase19
npm run lint
npm run typecheck
npm run build
```

Browser suites require an explicit Chromium CDP endpoint and matching `next start`/`next dev`; their environment variables are documented at the top of the scripts.
