# Accessibility

SOULBOUND keeps the narrative in real DOM text while treating WebGL, particles, fog, rings, arcs, duplicated fragments, and transition geometry as decorative. The page language is Russian; personal-media alternatives are short and neutral and never transcribe private screenshots.

## Interaction map

- Open Soul, Continue, S02 notification, S05 morning light, S06 heart, mute, YES, and THINK are native buttons.
- S09 is a native hold button. Space or Enter keydown starts the hold; keyup, blur, visibility loss, or pointer cancellation releases it. Repeated keydown is ignored.
- Controls exist in the tab order only while actionable. Focus is visible, and after an answer disappears focus moves to the stable ending container. Neither answer is autofocused.
- The final question is one accessible text unit. Its fieldset is labelled by the question. Animated rating frames are hidden from assistive technology and replaced with one stable interpretation.

## Motion

`CapabilityProvider` owns one live `FULL | REDUCED` motion mode from `prefers-reduced-motion`, with a development override. It is independent from `HIGH | MEDIUM | LOW` quality. Reduced mode lowers particle density, removes pointer parallax and camera shake, limits trails/displacement/orbits, suppresses continuous CSS motion, and uses shorter restrained fades while preserving scene order, reading holds, all ten Souls, Requiem, SILENCE, Final, YES, and THINK.

## Focus and visual preferences

All critical controls have a minimum practical hit area and a `:focus-visible` treatment. Browser zoom is not disabled. A basic forced-colors border keeps controls discoverable. Canvas and the bounded DOM Soul fallback are `aria-hidden`; the semantic story remains outside them.

## Known limits

The film requires JavaScript and targets browsers supported by Next.js 16. It does not add captions for decorative sound effects because all required story content is already textual. Full screen-reader production certification still requires device-level manual QA; the repository validators are guardrails, not a substitute for that inspection.

Run `npm run test:phase20:browser` against a development server and CDP-enabled Chromium for the mobile reduced-motion, mute, unavailable-audio, WebGL fallback, media fallback, recovery, and tab-visibility lifecycle checks.
