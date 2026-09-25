# Phase 17 — Desktop Visual Lock Report

Reference canvases: **1920×1080** and **2560×1440**, 100% browser zoom, CSS pixels. The production film, narrative, interaction model, Phase 16 timing, and audio mix remain authoritative.

## Shared system and audit

1. **Existing architecture.** Phase 17 retains the single `SceneDirector`, entering/active/exiting lifecycle, run-ID cancellation, persistent one-Canvas visual runtime, scoped particles/Souls, cached media, semantic audio, Soul HUD, transition bridges, Requiem hard cut, cinematic silence gate, Final Heart, and atomic YES/THINK endings discovered in Phases 0–16.
2. **Files created.** `src/lib/visuals/desktop.ts`, `src/lib/cinematic/phase17.test.ts`, `tsconfig.phase17-tests.json`, `scripts/validate-desktop.mjs`, `scripts/verify-phase17.mjs`, `scripts/verify-phase17-film.mjs`, `scripts/verify-phase17-responsive.mjs`, and this report.
3. **Files materially modified by Phase 17.** Shared globals/media/cursor/HUD/continue styles; the production scene style modules from PRELOADER through FINAL; the S09 image grade; the development-only visual-quality QA hook; `package.json`; and `README.md`. Earlier dirty Phase 15/16 work was preserved.
4. **Baseline findings.** The 1440p canvas made narrative/HUD text feel undersized; Continue read as a generic pill; S03 clipped its left foreground memory; S05/S06 over-enlarged tiny native screenshots; S07 had competing crimson layers; S08 declarations were trailer-like rather than editorial; S09 media/text were too suppressed; and Final was small at 1440p with a visible square media matte.
5. **Shared tokens.** `globals.css` now owns the near-black/charcoal/crimson/text palette, grading hooks, four typography roles, desktop safe areas, narrative measure, minimum hit size, and a compact spacing scale.
6. **Desktop safe margins.** Edge-safe is `clamp(32px, 4vw, 96px)`, text-safe is `clamp(58px, 6vw, 144px)`, and HUD-safe is `clamp(24px, 1.8vw, 38px)`. Scene-specific offsets remain where optical balance requires them.
7. **Typography roles.** Georgia/Times is the display and emotional narrative face; Arial/Helvetica is the neutral interface voice; the system monospace stack is reserved for HUD, status, and compact metadata. No new font payload was introduced.
8. **Sizing strategy.** All desktop hero and narrative sizes use bounded `clamp()` scales. Maxima stop 1440p from becoming oversized; minima keep laptop canvases legible.
9. **Narrative measure.** Emotional copy is constrained to roughly 26–32ch rather than stretching across wide canvases. Centered transition copy uses a similarly bounded measure.
10. **Wrap changes.** Wording and characters are unchanged. Widths and existing semantic spans now produce deliberate grouped lines for S01–S10, PRE_FINAL, SILENCE, and the two-line Final question without inserting text characters.
11. **Optical offsets.** S03 foreground/midground memories were shifted to 15%/48%/10%; Final Heart moved from 43% to 40% vertical center; S07 hero rests at 9% from the lower edge. These are composition corrections, not timing changes.
12. **Media treatment.** Screenshots use low-alpha borders, two-pixel corners where framing is needed, restrained shadows, matched near-black mattes, and scene-specific depth rather than a universal card system.
13. **Personal-media safeguards.** Polina video/image content is not displaced, chromatically split, or aggressively filtered. Low-resolution Good Morning and Heart Reaction captures have conservative physical sizes. Dragging and native media controls are disabled.
14. **Black-level strategy.** The shared near-black is `#050506`; exact `#000` remains reserved for SILENCE/Final boundaries. Media wrappers accept scene mattes. Final layers use screen blending plus a peripheral alpha mask to remove their source-square boundary.
15. **Crimson progression.** Early scenes remain sparse; S03 is desaturated; S07 is warm but darker; S08 is broad but controlled; S09/S10 retreat; Requiem remains the maximum; Final is warm without neon saturation.
16. **Glow hierarchy.** Cursor/HUD glows were reduced, memory borders softened, S07 rings separated from the portrait, S08 fragments dimmed, Requiem ring steps clarified, and Final halo expanded without clipping.
17. **Fog approach.** Existing scene-owned fog architecture is retained. Shared fog video receives 3% overscan; early neutral fog stays restrained, S03 crimson depth remains subtle, S09 keeps the strongest non-Requiem atmosphere while copy/media remain readable, and SILENCE remains fog-free.
18. **Particle approach.** Existing Phase 4 counts and scene choreography remain intact: early scenes sparse, S07 supportive around rather than over the portrait, S10 nearly empty, Requiem strongest, and YES semantically distinct. No broad count increase was made.
19. **Cursor.** Ring stays 24px at rest, 32px interactive, and 38px absorption; core is 5px. Position lag is smoother (`0.18`) and normalized pointer lag slower (`0.095`), preventing high-frequency mouse-follow motion.
20. **Controls.** Continue is now a 44px-minimum, square-cornered cinematic control with restrained gradient, uppercase system label, hover/focus/active states. Open Soul and answer controls preserve semantic equality and usable hit areas.
21. **HUD.** HUD is larger enough for 1440p, uses the shared system face and safe margin, loses the visible glass-card block, and dims to 18% so it supports rather than competes.

## Production sections

22. **PRELOADER.** Larger sigil/brand lockup, clearer small status copy, bounded 34–52px title, and restrained crimson presence.
23. **PROLOGUE.** Copy is capped at 28ch, narrative type grows without spanning the canvas, and Open Soul receives a reliable hit area and coherent interface typography.
24. **S01.** Cooler/darker room grade, 47vw-capped Discord artifact, minimal two-pixel frame, larger left-safe copy, and preserved low-amplitude parallax/overscan.
25. **S02.** Notification panels lose backdrop blur and excessive rounding; the special notification gains a restrained crimson edge; the reveal copy is capped at 30ch.
26. **S03.** Three memories now have clearer Z separation and matching S04 coordinates; the left memory no longer clips accidentally, streaks/red are reduced, and the right-bottom phrase has an intentional 27ch measure.
27. **S04.** The inherited memory world matches S03 geometry, thread weight/red are reduced, and the central line is larger but narrower.
28. **S05.** The 164×57 screenshot is no longer enlarged to 510px; its real aspect ratio is restored, the frame is flatter, and the phrase uses the text-safe right margin.
29. **S06.** The 165×60 reaction is capped at 420px, corners/shadow are quieter, the heart target remains 52px usable, and three narrative blocks gain readable scale.
30. **S07.** Stage saturation/brightness, warmth, petals, orbit, Pros card, and hero declaration are all reduced. The portrait stays central and undeformed; rating typography is clearer; “ВСЕГДА!!!” remains the terminal focal beat without swallowing the frame.
31. **S08.** Queen screenshot grows as a dim symbolic relic; fragment brightness and impact wash are reduced; two declarations use an editorial serif, bounded 140/148px maxima, and an 86vw composition.
32. **S09.** Pain image grows but loses its border/glow, its reveal grade rises from .55/.66 to .63/.72, copy becomes 24–32px at 32ch, and the hold control/label remain readable through heavy atmosphere.
33. **S10.** Anxiety clauses use a bounded 24–44px interface voice and 30ch measure. Existing minimal particles and void framing remain unchanged.
34. **PRE_FINAL.** The final vulnerability copy uses a 24–36px scale and 29ch measure while retaining its pauses and black field.
35. **SOULS_RELEASE.** Choreography, Soul ownership, detach stagger, constellation flight, HUD disintegration, and particle targets are unchanged; only shared HUD/cursor language carries through.
36. **REQUIEM.** Radial geometry expands for 1440p, ring opacity steps are separated, arcs are quieter, and blocky displacement amplitude drops. Cue timing and hard-cut ownership are untouched.
37. **SILENCE.** Exact black, hidden cursor/HUD, no fog/video/gradient/grain, and the zero-audio gate remain intact; text is slightly larger and capped at 28ch.
38. **FINAL.** Heart scales from 540px to a 760px cap, moves to 40% optical center, loses the rectangular matte through transparent wrappers/screen blending/peripheral masks, and the question becomes a balanced two-line 30ch composition.
39. **YES.** Existing Heart pulse, ten Soul echoes, particle release, music expansion, date reveal, and persistence are unchanged; shared button/Heart treatment improves the entry and stable frame.
40. **THINK.** Existing gentle settle, retained Heart, non-punitive music, and persistence are unchanged; the neutral button remains visually equal in weight to YES.

## QA and lock status

41. **1920×1080 full-film QA.** Natural PRELOADER→YES production traversal at 100% zoom/HIGH; audited key frames, interactions, one Canvas, idle bridge/mask, exact black body, and final persistence pass.
42. **2560×1440 full-film QA.** Natural PRELOADER→THINK production traversal at 100% zoom/HIGH; the same invariants and large-canvas compositions pass.
43. **1600×900 sanity.** HIGH key frames for S03/S07/S08/S09/FINAL pass with no foreground or document overflow.
44. **1440×900 and 1366×768 sanity.** Both HIGH sets pass; larger narrative type and Final controls remain separated at the minimum tested height.
45. **Review coverage.** Baseline and final full-film runners capture 28 audited frames per primary target; the responsive runner adds 15 focused frames across layered scenes.
46. **Transition regression.** All 15 canonical Phase 15 boundaries pass one representative Transition Lab run with clean bridge/mask cleanup, one Canvas, no browser errors, and correct destination state. Full-film runs cover FINAL→YES and FINAL→THINK.
47. **Requiem regression.** Three rings, arcs, hero/release peak, persistent Souls, cue ordering, and radial registration remain intact; no CSS delay reaches the hard cut.
48. **Silence verification.** The hard cut reaches exact `rgb(0, 0, 0)` with zero playing videos, hidden HUD/cursor, no gradient/fog/grain, and an idle transition state.
49. **Final registration.** C/A/B/FULL/halo layers remain concentric through reveal/merge/stable frames; the source-square matte is removed without changing layer order. A targeted post-tweak HIGH check at 2560×1440 reconfirmed the clean stable frame.
50. **Parallax extremes.** Existing S01/S03 amplitudes remain deliberately low, background media retain overscan, and secondary-width corner/edge audits reveal no gutters.
51. **Camera overscan.** Shared fog and moving scene backgrounds retain negative inset/scale coverage; S03 perspective and Final/Requiem center geometry remain within the viewport.
52. **Media/video edges.** No accidental black source rectangle, native controls, PiP control, drag ghost, or exposed video crop edge remains in reviewed frames.
53. **Overflow/scrollbars.** Audited primary and secondary frames report zero document X/Y overflow; visible semantic foreground elements remain inside the viewport.
54. **HIGH observation.** Headless Chromium completed the focused secondary and both full-film passes at HIGH without browser errors, resource leaks, extra Canvas creation, or obvious polish-induced stalls.
55. **MEDIUM observation.** Baseline natural runs and existing Phase 4 scaling remain valid at MEDIUM; compositions do not depend on maximum particle density because layout/media sizing is DOM/CSS driven.
56. **Remaining limitation.** Tiny personal screenshots necessarily retain their native-source softness, now controlled through smaller display sizes. Headless QA validates composition and state, not calibrated display color or subjective hardware playback smoothness.
57. **Command results.** All required validators (`assets`, `preload`, `audio`, `visuals`, `souls`, `requiem`, `ending`, `transitions`, `directing`, `scenes`, `final`, `desktop`), all prior automated tests through Phase 16, `test:phase17`, lint, typecheck, and production build pass. The browser runners generated and reviewed artifacts in `.next/phase15-browser`, `.next/phase17-responsive-high`, `.next/phase17-final-1920x1080-yes`, and `.next/phase17-final-2560x1440-think`; the subsequent production build cleared these disposable `.next` QA outputs, and the documented runners reproduce them.
58. **Phase 16 lock.** No `FILM_TIMING`, `FILM_MIX`, duck, crossfade, cue-map, voice, or semantic audio value was materially redesigned in Phase 17.
59. **Source/text lock.** No file under `public/assets` was modified, and automated exact-string assertions confirm mandatory narrative/answer text is unchanged.
60. **Scope boundary.** No Phase 18 mobile redesign, Phase 19 broad performance pass, or Phase 20 accessibility expansion was implemented. Existing responsive fallbacks and focus semantics were preserved.
61. **Lock declaration.** **DESKTOP VISUALS LOCKED FOR 1920×1080 AND 2560×1440.**
