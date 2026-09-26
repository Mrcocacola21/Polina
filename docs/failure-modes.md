# Failure modes and recovery

## Capability and media fallback

Feature detection is centralized and does not use browser-name sniffing. Web Audio unavailable, muted, and unmuted are separate states. Every production video has a settled fallback policy: GLOBAL-04A/B/C use static atmospheric CSS, `polina-circle.mp4` uses `polina.png`, S09 rain uses a dark CSS rain atmosphere, and REQ-04 uses the existing CSS/Soul/ring Requiem composition. Image errors render a matte/Heart fallback without a broken-image icon. Media failures are cached as failed; preloader groups settle as `ready-with-errors` and retries are explicit.

When WebGL creation fails or its context is lost, the single canvas is replaced by a bounded DOM/CSS Soul renderer. The same logical VisualRuntime remains authoritative, including fallback screen/world coordinates, collection, HUD absorption, release, Requiem, and Final. A restored context stays in DOM fallback until reload so a critical scene never jumps coordinate systems or creates a second runtime.

## Audio and visibility

Audio playback never gates scene progression. Requiem normally uses `AudioContext.currentTime`; without Web Audio it uses stored Phase 12 cue timings against a deterministic performance clock. If the audio clock stalls while visible, the visual clock switches after 1.5 seconds to a continuity-preserving fallback and still reaches the hard cut.

On `document.hidden`, the GSAP narrative timeline pauses, production videos pause, WebGL stops framing, and AudioEngine pauses its media elements and suspends its context without changing the user's mute preference. S09 releases its hold. On return, a 180 ms stabilization window precedes coherent resume. Missed one-shot sounds are not replayed. If browser policy rejects audio resume, a small semantic “Возобновить звук” button appears; visuals continue regardless. During Requiem the suspended AudioContext freezes its clock with the visuals, so hero timing remains aligned.

## Refresh recovery

In-progress state is local-only session storage under `soulbound.recovery.v1`; completed answers remain separately authoritative under `soulbound.answer.v1`, and mute uses `soulbound.audio.v1`. Recovery contains only schema version, safe scene/checkpoint, a contiguous Soul-ID prefix, and timestamp. It expires after eight hours and malformed, impossible, future-dated, or mismatched records are discarded.

Safe recovery restarts the current narrative segment rather than serializing animation frames. SOULS_RELEASE or REQUIEM refresh maps back to PRE_FINAL with ten committed Souls. SILENCE restarts at its boundary. Once the full Final question is visible, refresh restores the stable question and answer group directly. Stable YES/THINK persistence always wins and clears obsolete in-progress recovery. Soul restoration uses a side-effect-free runtime API, so no collection sound, flight, particle, or voice is replayed.

## Fatal and development behavior

Missing media, audio, or WebGL is nonfatal and degrades quietly. A 30-second enter / 15-second exit watchdog prevents a failed optional transition from trapping SceneDirector. A root error boundary provides concise retry/restart actions without exposing stack traces or producing a white page.

Development-only `?debug=1&failureLab=1` reports motion, quality, audio, mute, WebGL, visibility, focus, recovery, and media failures. It can override reduced motion, mute, audio/WebGL availability, media kinds, and recovery records without changing OS settings. Reset removes overrides; recovery, answer, and audio preferences have separate clear controls.

The reproducible browser exercise is `npm run test:phase20:browser`; it expects a development server at `SOULBOUND_ORIGIN` and a Chromium DevTools endpoint at `SOULBOUND_CDP`.
