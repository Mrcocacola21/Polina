import type { MotionMode } from "../accessibility/capabilities";
import type { VisualQuality } from "./quality";

export type CinematicFracturePreset = Readonly<{
  intensity: number;
  sliceAmount: number;
  sliceCount: number;
  chromaticOffset: number;
  verticalShear: number;
  lumaTear: number;
  frameEcho: number;
  scanlineWarp: number;
  edgeEnergy: number;
  duration: number;
  seed: number;
  blackTears: number;
  radialStretch: number;
  protectedBand?: readonly [number, number];
  revealImageUrl?: string;
  revealAmount?: number;
}>;

export type CinematicFractureEnvironment = Readonly<{
  quality: VisualQuality;
  motionMode: MotionMode;
  mobile: boolean;
}>;

export type ResolvedCinematicFracture = CinematicFracturePreset;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function resolveCinematicFracture(
  preset: CinematicFracturePreset,
  environment: CinematicFractureEnvironment,
): ResolvedCinematicFracture {
  const qualityScale = environment.quality === "HIGH" ? 1 : environment.quality === "MEDIUM" ? 0.78 : 0.56;
  const mobileScale = environment.mobile ? 0.66 : 1;
  const reduced = environment.motionMode === "REDUCED";
  const motionScale = reduced ? 0.28 : 1;
  return {
    ...preset,
    intensity: clamp(preset.intensity * motionScale, 0, 1),
    sliceAmount: clamp(preset.sliceAmount * qualityScale * mobileScale * motionScale, 0, environment.mobile ? 14 : 24),
    sliceCount: preset.sliceCount <= 0
      ? 0
      : reduced
        ? 1
        : Math.max(2, Math.round(preset.sliceCount * qualityScale * (environment.mobile ? 0.72 : 1))),
    chromaticOffset: reduced
      ? 0
      : clamp(preset.chromaticOffset * qualityScale * mobileScale, 0, environment.mobile ? 2 : 4),
    verticalShear: reduced ? 0 : preset.verticalShear * qualityScale * mobileScale,
    lumaTear: reduced ? Math.min(0.08, preset.lumaTear) : preset.lumaTear * qualityScale,
    frameEcho: reduced ? 0 : preset.frameEcho * qualityScale,
    scanlineWarp: reduced ? 0 : preset.scanlineWarp * qualityScale,
    edgeEnergy: reduced ? Math.min(0.12, preset.edgeEnergy) : preset.edgeEnergy * qualityScale,
    duration: reduced ? Math.min(140, preset.duration) : clamp(preset.duration, 40, 350),
    blackTears: reduced ? Math.min(1, preset.blackTears) : Math.round(preset.blackTears * qualityScale),
    radialStretch: preset.radialStretch * motionScale * qualityScale,
    revealAmount: reduced ? Math.min(0.3, preset.revealAmount ?? 0) : preset.revealAmount,
  };
}

function seededRandom(seed: number): () => number {
  let value = Math.max(1, Math.floor(seed)) >>> 0;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4_294_967_295;
  };
}

function sanitizeClone(element: HTMLElement): void {
  element.setAttribute("aria-hidden", "true");
  element.removeAttribute("aria-label");
  element.removeAttribute("data-testid");
  element.querySelectorAll<HTMLElement>("[data-testid], [aria-label]").forEach((node) => {
    node.removeAttribute("data-testid");
    node.removeAttribute("aria-label");
    node.setAttribute("aria-hidden", "true");
  });
  element.querySelectorAll<HTMLElement>("[data-cinematic-fracture-host]").forEach((node) => node.remove());
  element.querySelectorAll<HTMLVideoElement>("video").forEach((video) => {
    // A fracture is a pixel echo, not another media player. Keep the poster,
    // but prevent short-lived clones from decoding or playing duplicate video.
    video.autoplay = false;
    video.loop = false;
    video.removeAttribute("autoplay");
    video.removeAttribute("loop");
    video.removeAttribute("src");
    video.querySelectorAll("source").forEach((source) => source.remove());
  });
}

function styleClone(clone: HTMLElement): void {
  clone.style.position = "absolute";
  clone.style.inset = "0";
  clone.style.width = "100%";
  clone.style.height = "100%";
  clone.style.pointerEvents = "none";
  clone.style.opacity = "1";
  clone.style.margin = "0";
}

/**
 * A short-lived DOM compositor. It never draws a noise/displacement texture:
 * each tear is a clipped copy of the scene's own pixels, offset for a few frames.
 */
export class CinematicFractureController {
  readonly #source: HTMLElement;
  readonly #host: HTMLElement;
  #generation = 0;
  #timer?: number;

  constructor(source: HTMLElement, host: HTMLElement) {
    this.#source = source;
    this.#host = host;
    this.#host.dataset.cinematicFractureHost = "true";
  }

  fracture(preset: CinematicFracturePreset, environment: CinematicFractureEnvironment): ResolvedCinematicFracture {
    const settings = resolveCinematicFracture(preset, environment);
    this.clear();
    const generation = ++this.#generation;
    const random = seededRandom(settings.seed);
    const fragment = document.createDocumentFragment();
    const protectedBand = settings.protectedBand;

    this.#host.dataset.fractureActive = "true";
    this.#host.dataset.fractureSeed = String(settings.seed);
    this.#host.style.display = "block";

    const bands: Array<readonly [number, number]> = [];
    for (let index = 0; index < settings.sliceCount; index += 1) {
      const height = 3.5 + random() * (settings.intensity > 0.75 ? 10 : 6.5);
      const top = clamp(4 + random() * 88, 0, 100 - height);
      bands.push([top, top + height]);
    }
    bands.sort((a, b) => a[0] - b[0]);

    bands.forEach(([top, bottom], index) => {
      const wrapper = document.createElement("div");
      const clone = this.#source.cloneNode(true) as HTMLElement;
      sanitizeClone(clone);
      styleClone(clone);
      const bandHeight = bottom - top;
      wrapper.className = "cinematic-fracture-slice";
      wrapper.style.position = "absolute";
      wrapper.style.left = "0";
      wrapper.style.right = "0";
      wrapper.style.top = `${top}%`;
      wrapper.style.height = `${bandHeight}%`;
      wrapper.style.overflow = "hidden";
      wrapper.style.pointerEvents = "none";
      wrapper.style.willChange = "transform, opacity, filter";
      clone.style.inset = "auto 0 auto 0";
      clone.style.top = `${-top / bandHeight * 100}%`;
      clone.style.height = `${100 / bandHeight * 100}%`;

      const center = (top + bottom) / 2;
      const isProtected = protectedBand !== undefined && center >= protectedBand[0] * 100 && center <= protectedBand[1] * 100;
      const direction = (index + Math.floor(random() * 2)) % 2 === 0 ? 1 : -1;
      const displacement = settings.sliceAmount * (0.44 + random() * 0.56) * direction * (isProtected ? 0.24 : 1);
      const y = settings.verticalShear * (random() - 0.5) * (isProtected ? 0 : 1);
      const skew = settings.scanlineWarp * (random() - 0.5);
      const brightness = 1 + settings.lumaTear * (random() - 0.62);
      const crimson = Math.round(72 + settings.edgeEnergy * 92);
      clone.style.filter = [
        `brightness(${brightness.toFixed(3)})`,
        `contrast(${(1 + settings.lumaTear * 0.22).toFixed(3)})`,
        settings.chromaticOffset > 0
          ? `drop-shadow(${settings.chromaticOffset * direction}px 0 rgb(${crimson} 4 24 / ${Math.min(0.5, settings.edgeEnergy * 0.42)}))`
          : "",
        settings.chromaticOffset > 0
          ? `drop-shadow(${-settings.chromaticOffset * direction * 0.55}px 0 rgb(150 180 190 / ${Math.min(0.12, settings.edgeEnergy * 0.12)}))`
          : "",
      ].filter(Boolean).join(" ");
      clone.style.transform = settings.radialStretch > 0
        ? `scale(${(1 + settings.radialStretch).toFixed(4)})`
        : "none";
      clone.style.transformOrigin = "50% 50%";
      wrapper.append(clone);

      if (settings.revealImageUrl && random() < (settings.revealAmount ?? 0)) {
        const reveal = document.createElement("i");
        reveal.style.position = "absolute";
        reveal.style.left = "0";
        reveal.style.right = "0";
        reveal.style.top = `${-top / bandHeight * 100}%`;
        reveal.style.height = `${100 / bandHeight * 100}%`;
        reveal.style.background = `#020102 url("${settings.revealImageUrl}") center / cover no-repeat`;
        reveal.style.filter = "brightness(.46) saturate(.78) contrast(1.12)";
        reveal.style.opacity = String(0.45 + settings.intensity * 0.42);
        reveal.style.transform = `translateX(${-displacement * 0.35}px) scale(1.012)`;
        wrapper.append(reveal);
      }

      wrapper.animate([
        { opacity: 0, transform: "translate3d(0,0,0) skewX(0deg)" },
        { opacity: 1, transform: `translate3d(${displacement}px,${y}px,0) skewX(${skew}deg)`, offset: 0.18 },
        { opacity: 0.88, transform: `translate3d(${-displacement * 0.18}px,0,0) skewX(${-skew * 0.25}deg)`, offset: 0.68 },
        { opacity: 0, transform: "translate3d(0,0,0) skewX(0deg)" },
      ], { duration: settings.duration, easing: "cubic-bezier(.2,.72,.22,1)", fill: "both" });
      fragment.append(wrapper);
    });

    for (let index = 0; index < settings.blackTears; index += 1) {
      const tear = document.createElement("b");
      const height = 1 + random() * (settings.intensity > 0.8 ? 5 : 2.4);
      tear.className = "cinematic-fracture-black-tear";
      tear.style.position = "absolute";
      tear.style.left = "0";
      tear.style.right = "0";
      tear.style.top = `${8 + random() * 82}%`;
      tear.style.height = `${height}%`;
      tear.style.background = "#000";
      tear.style.transformOrigin = random() > 0.5 ? "left" : "right";
      tear.animate([
        { opacity: 0, transform: "scaleX(.3)" },
        { opacity: 0.96, transform: "scaleX(1)", offset: 0.28 },
        { opacity: 0, transform: "scaleX(.72)" },
      ], { duration: settings.duration * 0.72, easing: "steps(2, end)", fill: "both" });
      fragment.append(tear);
    }

    if (settings.frameEcho > 0) {
      const echo = this.#source.cloneNode(true) as HTMLElement;
      sanitizeClone(echo);
      styleClone(echo);
      echo.className = "cinematic-fracture-echo";
      echo.style.clipPath = `inset(${18 + random() * 42}% 0 ${12 + random() * 24}% 0)`;
      echo.style.filter = "brightness(.42) sepia(.38) saturate(1.35) hue-rotate(320deg)";
      echo.animate([
        { opacity: 0, transform: "translateX(0)" },
        { opacity: settings.frameEcho, transform: `translateX(${Math.min(6, settings.sliceAmount * 0.34)}px)`, offset: 0.25 },
        { opacity: 0, transform: "translateX(0)" },
      ], { duration: Math.min(90, settings.duration), easing: "steps(2, end)", fill: "both" });
      fragment.append(echo);
    }

    this.#host.replaceChildren(fragment);
    this.#timer = window.setTimeout(() => {
      if (this.#generation === generation) this.clear();
    }, settings.duration + 34);
    return settings;
  }

  clear(): void {
    if (this.#timer !== undefined) window.clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#host.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
    this.#host.replaceChildren();
    this.#host.style.display = "none";
    this.#host.dataset.fractureActive = "false";
  }

  dispose(): void {
    this.clear();
    this.#generation += 1;
  }
}
