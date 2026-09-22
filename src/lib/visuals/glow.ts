export const GLOW_PALETTE = Object.freeze({
  black: "#050506",
  nearBlack: "#09090b",
  charcoal: "#101014",
  darkCrimson: "#7a0d19",
  crimson: "#bb1730",
  brightCrimson: "#de2440",
  white: "#eeeef1",
  coolGreyBlue: "#596171",
});

export function domGlow(
  color: "crimson" | "white" = "crimson",
  intensity = 1,
): Readonly<{ filter: string; boxShadow: string; textShadow: string }> {
  const rgb = color === "white" ? "238 238 241" : "222 36 64";
  const strength = Math.max(0, Math.min(2, intensity));
  return {
    filter: `drop-shadow(0 0 ${8 * strength}px rgb(${rgb} / ${0.35 * strength}))`,
    boxShadow: `0 0 ${24 * strength}px rgb(${rgb} / ${0.22 * strength})`,
    textShadow: `0 0 ${12 * strength}px rgb(${rgb} / ${0.55 * strength})`,
  };
}

export const WEBGL_GLOW_DEFAULTS = Object.freeze({
  blending: "additive" as const,
  crimson: GLOW_PALETTE.brightCrimson,
  opacity: 0.18,
  scale: 1.85,
});

