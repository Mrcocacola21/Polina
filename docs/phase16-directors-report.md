# Phase 16 Director's Report

## Outcome

Phase 16 is a timing and non-destructive audio-mix pass over the existing Phase 0–15 film. It adds no story, scene, interaction, generated asset, media file, visual system, or Phase 17+ feature. Mandatory narrative copy and all source media remain unchanged.

The production-like acceptance runs completed from PRELOADER without debug jumps or scene-state forcing:

- YES: 371.668 s (6:11.668) to stable ending.
- THINK: 362.695 s (6:02.695) to stable ending.
- Both runs: 17 sequential run IDs, zero browser errors, zero empty frames, zero white frames, one persistent canvas, correct local answer persistence.

The browser runner used immediate natural interaction once each authored control became available. Human runtime is therefore open-ended by design; a typical unhurried traversal is approximately 6:45–7:30, plus any time the viewer chooses to spend at the five indefinite interaction gates and Final choice.

## Architecture found and preserved

The film already used one `SceneDirector`, one session-wide native-Web-Audio `AudioEngine`, one persistent `VisualRuntime`, scene/run-scoped audio and visual cleanup, transactional ten-Soul collection, audio-clocked Requiem cues, exact cinematic silence, and terminal persisted endings. Phase 15 supplied the typed boundary registry and persistent bridge layer. Phase 16 retains those ownership boundaries.

The new directing layer does not replace scene architecture. `src/lib/cinematic/directing.ts` is the inspectable mix sheet for `FILM_TIMING`, `FILM_MIX`, `DUCK_PRESETS`, `CROSSFADE_PRESETS`, collection timing/scales, and the semantic music cue sequence. Existing phase configs now alias the central values. AudioEngine gained a cinematic per-track gain, separate from stored user bus volume, including same-state gain ramps that do not restart music.

## Files

Created for Phase 16:

- `src/lib/cinematic/directing.ts`
- `src/lib/cinematic/phase16.test.ts`
- `tsconfig.phase16-tests.json`
- `scripts/validate-directing.mjs`
- `scripts/verify-phase16.mjs`
- `scripts/verify-phase16-film.mjs`
- `docs/phase16-directors-report.md`

Materially modified for Phase 16:

- `src/lib/audio/AudioEngine.ts`, `src/lib/audio/types.ts`
- `src/lib/cinematic/phase6.ts` through `phase14.ts`
- `src/lib/souls/SoulCollectionRuntime.ts`
- production scenes from `PrologueScene.tsx` through `FinalScene.tsx`, including release and Requiem
- `src/components/audio/AudioDebugPanel.tsx`
- `package.json`, `README.md`

Phase 15 files already present in the dirty working tree were preserved.

## Baseline audit

The pre-change uninterrupted baseline took approximately 371 s to stable YES and 359 s to stable THINK (728.026 s wall time for both runs). Its main pacing issues were not overall length but local shape:

- S09's final pain line had only about 1.8 s fully stable after its reveal.
- S10 calm, PRE_FINAL suspension, and Final question/tag/choice were not cleanly separated into readable beats.
- The ten collection rituals were effectively the same rhythm, making the motif feel like a repeated loading animation.
- Some post-collection count holds were too uniform.

The main mix issues were:

- semantic music states had no independent cinematic gain, so scene intent could not be separated cleanly from the user's Music preference;
- unchanged music states could not be reshaped without risking restart-like behavior;
- SF voice ducks could release before the measured source finished, especially voice A;
- Queen, Requiem, and YES source peaks left insufficient obvious headroom if played with near-uniform coefficients;
- repeated Soul spawn/fly and S07 procedural rise were fatigue risks;
- S01 room ambience was guarded by a module-global one-shot and therefore did not reliably return on a second full film in the same browser session.

## Final measured scene durations

Common scene values are the mean of the final YES and THINK production-like runs. FINAL pre-answer is separated from the ending branch so the two outcomes remain comparable.

| Scene | Final measured duration |
|---|---:|
| PRELOADER | 2.691 s |
| PROLOGUE | 16.561 s |
| S01 | 19.365 s |
| S02 | 22.556 s |
| S03 | 33.906 s |
| S04 | 16.461 s |
| S05 | 21.540 s |
| S06 | 17.538 s |
| S07 | 29.114 s |
| S08 | 22.274 s |
| S09 | 35.715 s |
| S10 | 46.554 s |
| PRE_FINAL | 19.770 s |
| SOULS_RELEASE | 6.181 s |
| REQUIEM | 12.649 s |
| SILENCE | 16.950 s |
| FINAL, entry to answer controls | 19.783 s mean (YES 19.808 / THINK 19.757) |
| YES, click to stable | 12.228 s |
| THINK, click to stable | 2.843 s |

Major final cue timestamps in the YES run: Open Soul 17.036 s, S02 special notification 47.222 s, S05 light 112.753 s, S06 heart 134.543 s, S09 hold start 220.921 s, digital silence 322.719 s, answer controls 359.440 s.

## Pacing decisions

- Prologue: the two setup lines, quick `логично` aside, copy exit, and Open Soul anticipation are separately timed; the first click remains indefinite and meaningful.
- S01: Discord, both phrases, the calm beat, collection, and 1.55 s post-commit hold remain deliberately quiet. Its ambience now starts on every run rather than only once per tab.
- S02: two ordinary notifications breathe before the special notification; the special interaction remains indefinite. Post-open lines lead to collection with a 1.45 s HUD-count hold.
- S03: the camera pass lasts 17.5 s; memories enter at 2.8/7.1/11.55 s, text at 18.05/20.8 s, and collection at 25 s. The viewer can recognize images before convergence.
- S04: memories recede rapidly, the phrase enters at 4.2 s, resolves before collection at 9.05 s, and stays quiet without becoming digitally silent.
- S05: the morning interaction remains discoverable but indefinite; after the click, the screenshot, spaced text/piano beats, collection, and 1.55 s count hold are distinct.
- S06: three playful phrase blocks are separated at 1.05/3.35/5.65 s after interaction; collection starts at 9.65 s.
- S07: sincerity owns the opening; rating starts at 9.2 s, takes 5.8 s to the absurd acceleration, resolves into infinity/`ВСЕГДА!!!`, then leaves room before the parenthetical at 18.1 s and collection at 21.55 s.
- S08: Queen is a short peak, with declarations at 5.15 and 9.85 s and de-escalation before collection at 14.35 s. Maximum intensity is not held through the entire scene.
- S09: the hold control remains indefinite and requires the real input gesture. The final line now has a 5.3 s authored window; after its 1.45 s reveal it is fully stable for about 3.85 s before collection/continuation pressure.
- S10: `потому что люблю тебя` has a dedicated 3.45 s calm hold, categorically separated from returning fear. The final anxiety line has 5.05 s before collection; ten-Soul HUD settle is 2 s.
- PRE_FINAL: `но можна я..` enters at 12 s and has a 4.3 s suspension; Continue is not exposed until 16.8 s.
- SOULS_RELEASE: music reaches zero over 1.6 s, detach is staggered by 0.18 s, constellation flight lasts 1.4 s, HUD disintegrates at 2.7 s, and automatic advance occurs at 6.05 s.
- Requiem: 1.8 s arrangement, three rings at 0.65/1.5/2.35 s, arcs at 3.15 s, contraction at 3.75 s, hero at 4.3 s. The source-authored hard cut remains 5.18 s after hero start; it was not changed.
- Silence: 2.4 s of absolute black before text. Four lines have individual full-read windows and the handoff remains at 16.95 s. Audio is exact digital zero for the entire section.
- Final: awakening at 0.95 s; progressive text culminates at 11.72 s; the complete question holds 3.5 s before the tag; stable/tag and answer reveal are separate, with controls 2.55 s after Final stable. AUD-FIN-01 is the first audible event after the silence gate opens.
- YES: 0.32 s stillness, heart/echo/release sequence, 4.75 s release settle, date only at 7.25 s, stable at 12.2 s.
- THINK: no punitive drop; controls recede, the state calms at 1.5 s, and becomes stable at 2.8 s.

Collections retain one visual language but have distinct durations: NORMAL base 3.74 s, SILENT base 4.04 s with no ritual sound, and DEEP base 5.44 s. Per-scene scales range from 0.90 to 1.04, and post-collection holds range from 1.4 to 2.0 s.

## Semantic music mix

All values are linear cinematic coefficients before the user's Music bus setting. The neutral default Music bus (0.70) remains unchanged.

| Beat | State | Gain | Approx. dB |
|---|---|---:|---:|
| Prologue / S01 / S02 | MUS-01 NIGHT | 0.42 | -7.5 dB |
| S03 | MUS-02 MEMORIES | 0.56 | -5.0 dB |
| S04 distant | MUS-02 MEMORIES | 0.44 | -7.1 dB |
| S05 | MUS-02 MEMORIES | 0.54 | -5.4 dB |
| S06 | MUS-02 MEMORIES | 0.56 | -5.0 dB |
| S07 | MUS-02 MEMORIES | 0.58 | -4.7 dB |
| S08 Queen | MUS-02 MEMORIES | 0.50 | -6.0 dB |
| S09 | MUS-03 VULNERABILITY | 0.40 | -8.0 dB |
| S10 | MUS-03 VULNERABILITY | 0.32 | -9.9 dB |
| PRE_FINAL | MUS-03 VULNERABILITY | 0.20 | -14.0 dB |
| Release / Requiem / Silence | zero | 0 | -∞ |
| Final pre-answer | MUS-04 HEART_AND_SOUL | 0.34 | -9.4 dB |
| YES | same MUS-04, no restart | 0.60 | -4.4 dB |
| THINK | same MUS-04, no restart | 0.40 | -8.0 dB |

Crossfades: none→MUS-01 3.0 s; MUS-01→MUS-02 5.2 s; MUS-02→MUS-03 6.2 s; MUS-03→zero 1.6 s; zero→MUS-04 5.4 s; same-state YES expansion 2.6 s; same-state THINK settle 1.4 s. Unchanged semantic states ramp gain/filter intent without restarting the track.

## Ambience, SFX, voices, and ducking

Ambience coefficients:

| Ambience | Gain |
|---|---:|
| S01 room | 0.10 |
| S03 memory atmosphere | 0.10 |
| S05 morning | 0.09 |
| S09 drone | 0.18 |
| S09 rain | 0.26 |

Important SFX coefficients:

| Group | Final gains |
|---|---|
| Open Soul | 0.68 |
| S02 ordinary / warm / open | 0.48 / 0.58 / 0.56 |
| S03 memory / pass | 0.42 / 0.34 |
| S05 reveal / piano A/B/C | 0.44 / 0.38 / 0.36 / 0.40 |
| S06 heart | 0.48 |
| S07 arrival / procedural rise / resolve / pop | 0.42 / 0.024 / 0.48 / 0.22 |
| S08 arrival / sigil / fragments / declaration | 0.56 / 0.38 / 0.42 / 0.60 |
| S09 absorption / fractured light / completion | 0.24 / 0.20 / 0.38 |
| Soul spawn/fly NORMAL | 0.66 / 0.52 |
| Soul spawn/fly DEEP | 0.50 / 0.42 |
| Release fly | 0.09 |
| Requiem rings 1/2/3 / arcs / hero | 0.44 / 0.46 / 0.48 / 0.72 / 0.74 |
| Final awakening / merge / halo | 0.74 / 0.76 / 0.72 |
| YES release / resolve | 0.62 / 0.58 |

SF voice cinematic gains are A 0.80, B 0.80, C 0.92. At the neutral SFX bus value of 0.85 these become 0.68, 0.68, and 0.782 before source amplitude and Master. Voice ducks reduce music to 0.60 (about -4.4 dB) with 0.12 s attack. Holds are 3.85/3.05/2.20 s for A/B/C and release is 0.90 s, covering measured source lengths rather than releasing mid-line. Other main ducks: Open Soul 0.74/0.08/0.72/1.15; intimate notification 0.82/0.08/0.30/0.85; morning reveal 0.86/0.12/0.35/1.05; Queen arrival 0.72/0.10/0.50/1.35; Queen declaration 0.64/0.08/0.72/1.65; pain completion 0.80/0.12/0.55/1.35. Values are `to / attack / hold / release`. Token cleanup and strongest-overlap behavior pass automated tests.

## Source analysis and headroom

Offline `ffmpeg volumedetect` informed coefficients without changing files:

- AUD-PRO-01: 3.2 s, mean -15.5 dB, peak -4.0 dB.
- AUD-GLOBAL-01: mean -19.6 dB, peak -5.5 dB.
- SF A/B/C: 4.493/3.657/2.769 s; mean -19.5/-19.5/-21.4 dB; peak -5.3/-5.8/-5.9 dB.
- AUD-GLOBAL-03 reaches 0.0 dB peak, so its runtime coefficient remains conservative.
- S02 cues peak around -11 dB; S07 cues around -2 dB; AUD-S08-04 peaks at -2.2 dB.
- S09 drone is dense (mean -11.6 dB) while rain is sparse (mean -34.1 dB), hence their intentionally different coefficients.
- Requiem rings peak at -4.0/-0.8/-3.4 dB; arcs peak at -23.4 dB; hero is mean -12.6 dB and peak -0.3 dB.
- Final cues peak at -8.0/-7.5/-8.5 dB. Both YES cues peak at -1.0 dB.
- MUS-01/02/03/04 peak at about -1.1 dB; means are -14.8/-14.8/-15.2/-16.2 dB.

Queen leaves headroom by lowering MUS-02 from the S07 peak and controlling its high-peak impacts. Requiem becomes the largest spectacle through the exact preceding decay/zero boundary, staggered buildup, relatively larger arc/hero coefficients, and the source-authored transient—not by raising the master or flattening with compression. YES opens MUS-04 and two existing cues warmly but remains below the Requiem strategy. The 5.18 s hero hard cut is single-fire, enters the cinematic gate at exact zero, and SILENCE has no ambience, music, or simulated noise floor.

Repeated collection SFX were lowered and scene-scaled; S07's procedural ceiling and gain were reduced to prevent high-frequency fatigue. Low-frequency accumulation is controlled by pulling the dense S09 drone down, tapering MUS-03 toward PRE_FINAL, and reaching zero before Requiem. No new pan automation was introduced; authored stereo/pan behavior and current engine routing were preserved.

## Full-film verification

The final YES and THINK runs used the optimized build served by `next start`, a clean answer store, neutral user mixer settings, and only natural controls. No code was patched between those two acceptance runs. Afterward only this report and README were updated.

Both ending screenshots were visually inspected: YES resolves to the heart and delayed date; THINK retains the heart, full question, and quiet tag. The raw timing report and screenshots are generated under `.next/phase16-film/`.

Validation results:

- `validate:assets`, `validate:preload`, `validate:audio`, `validate:visuals`, `validate:souls`, `validate:requiem`, `validate:ending`, `validate:transitions`, `validate:scenes`, `validate:final`, `validate:directing`: pass.
- `test:cinematic`, `test:media`, `test:audio`, `test:souls`, `test:phase6` through `test:phase16`: pass.
- `lint`, `typecheck`, `build`: pass.
- `test:phase16:film`: pass for uninterrupted YES and THINK.
- `git diff -- public/assets`: empty; source media were not modified.

## Environment limitation and manual listening note

The available browser was headless, so runtime timing, graph state, silence semantics, source levels, cue ordering, persistence, frame continuity, and visuals were verified, but the environment cannot provide a trustworthy human headphone/speaker audition. The only unresolved subjective acceptance item is a final real-device listen for perceived spectral balance, stereo image, and fatigue—especially the S08 declaration into S09, the Requiem hero transient, and YES release. No measured or structural issue remains open, and no user volume adjustment was made by the automated passes.
