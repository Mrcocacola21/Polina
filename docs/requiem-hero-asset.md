# Requiem hero asset pipeline

`public/assets/REQ/ShadowFiendREQ.mp4` is the untouched 720×720, 60 fps,
5.383-second H.264 source. It contains an AAC track that is never used by the
film.

Run `npm run prepare:requiem-hero` after replacing that source. The script
creates `public/assets/REQ/ShadowFiendREQ-keyed.webm`, a silent VP9-alpha
derivative. The reproducible filter chain removes the static capture label,
keys the green plate, suppresses green spill, feathers the key, reconstructs
the center gameplay HUD strip, removes the capture's residual olive terrain,
and applies a restrained crimson-scene grade.
The source is never overwritten.

The clip starts 0.20 seconds before the authoritative `AUD-REQ-05` hero clock.
Its measured cast release at source time 1.96 seconds therefore lands on the
existing `primaryImpact` cue at hero time 1.76 seconds. The clip end lands at
the existing 5.18-second hard cut.
