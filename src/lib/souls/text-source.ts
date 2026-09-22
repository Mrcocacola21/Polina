import gsap from "gsap";

const MAX_FRAGMENT_GLYPHS = 160;

type SavedInlineStyle = Readonly<{
  visibility: string;
  opacity: string;
  filter: string;
}>;

function seeded(index: number, seed: number): number {
  const value = Math.sin((index + 1) * 12.9898 + seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function animateTimeline(
  create: (timeline: gsap.core.Timeline) => void,
  signal: AbortSignal,
): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (completed: boolean) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      resolve(completed);
    };
    const timeline = gsap.timeline({
      onComplete: () => finish(true),
      onInterrupt: () => finish(false),
    });
    const abort = () => {
      timeline.kill();
      finish(false);
    };
    signal.addEventListener("abort", abort, { once: true });
    create(timeline);
  });
}

function segmentText(value: string): readonly Readonly<{ segment: string; index: number }>[] {
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return [...segmenter.segment(value)].map(({ segment, index }) => ({ segment, index }));
  }
  const fallback: Array<{ segment: string; index: number }> = [];
  let offset = 0;
  for (const segment of Array.from(value)) {
    fallback.push({ segment, index: offset });
    offset += segment.length;
  }
  return fallback;
}

type MeasuredFragment = Readonly<{
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
}>;

function measureFragments(element: HTMLElement): readonly MeasuredFragment[] {
  const measured: MeasuredFragment[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const textNode = node as Text;
    const value = textNode.data;
    for (const { segment, index } of segmentText(value)) {
      if (!segment.trim()) continue;
      const range = document.createRange();
      range.setStart(textNode, index);
      range.setEnd(textNode, index + segment.length);
      const rect = range.getBoundingClientRect();
      range.detach();
      if (rect.width > 0 && rect.height > 0) {
        measured.push({
          text: segment,
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        });
      }
    }
    node = walker.nextNode();
  }
  if (measured.length <= MAX_FRAGMENT_GLYPHS) return measured;
  const stride = Math.ceil(measured.length / MAX_FRAGMENT_GLYPHS);
  return measured.filter((_, index) => index % stride === 0).slice(0, MAX_FRAGMENT_GLYPHS);
}

export type TextFragmentOverlay = Readonly<{
  sourceRect: DOMRect;
  convergence: readonly [number, number];
  fragmentCount: number;
  glow(duration: number, intensity: number, signal: AbortSignal): Promise<boolean>;
  fragment(duration: number, signal: AbortSignal): Promise<boolean>;
  converge(
    point: readonly [number, number],
    duration: number,
    signal: AbortSignal,
  ): Promise<boolean>;
  cleanup(restoreSource: boolean): void;
}>;

export function createTextFragmentOverlay(
  element: HTMLElement,
  seed: number,
): TextFragmentOverlay | null {
  const sourceRect = element.getBoundingClientRect();
  const fragments = measureFragments(element);
  if (
    fragments.length === 0 ||
    sourceRect.width <= 0 ||
    sourceRect.height <= 0
  ) return null;

  const style = window.getComputedStyle(element);
  const saved: SavedInlineStyle = {
    visibility: element.style.visibility,
    opacity: element.style.opacity,
    filter: element.style.filter,
  };
  const overlay = document.createElement("div");
  overlay.dataset.soulFragmentOverlay = "true";
  overlay.setAttribute("aria-hidden", "true");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "60",
    pointerEvents: "none",
    overflow: "hidden",
    opacity: "0",
  });
  const nodes = fragments.map((fragment) => {
    const span = document.createElement("span");
    span.textContent = fragment.text;
    Object.assign(span.style, {
      position: "fixed",
      left: `${fragment.left}px`,
      top: `${fragment.top}px`,
      width: `${fragment.width}px`,
      height: `${fragment.height}px`,
      color: style.color,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontStyle: style.fontStyle,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      textTransform: style.textTransform,
      whiteSpace: "pre",
      transformOrigin: "center",
      willChange: "transform, opacity, filter",
    });
    overlay.appendChild(span);
    return span;
  });
  const host = document.querySelector<HTMLElement>("[data-cinematic-stage]") ?? document.body;
  host.appendChild(overlay);

  let activeTimeline: gsap.core.Timeline | undefined;
  let disposed = false;
  const activate = () => {
    if (disposed) return;
    overlay.style.opacity = "1";
    element.style.visibility = "hidden";
  };

  return {
    sourceRect,
    convergence: [
      sourceRect.left + sourceRect.width / 2,
      sourceRect.top + sourceRect.height / 2,
    ],
    fragmentCount: nodes.length,
    glow: (duration, intensity, signal) =>
      animateTimeline((timeline) => {
        activeTimeline = timeline;
        timeline.to(element, {
          filter: `drop-shadow(0 0 ${8 * intensity}px rgb(222 36 64 / 0.58))`,
          opacity: 0.94,
          duration,
          ease: "power2.inOut",
        });
      }, signal),
    fragment: (duration, signal) => {
      activate();
      return animateTimeline((timeline) => {
        activeTimeline = timeline;
        nodes.forEach((node, index) => {
          timeline.to(node, {
            x: (seeded(index * 3, seed) - 0.5) * 18,
            y: (seeded(index * 3 + 1, seed) - 0.5) * 14,
            rotation: (seeded(index * 3 + 2, seed) - 0.5) * 12,
            color: "#de2440",
            opacity: 0.86,
            duration,
            ease: "power2.out",
          }, 0);
        });
      }, signal);
    },
    converge: (point, duration, signal) =>
      animateTimeline((timeline) => {
        activeTimeline = timeline;
        nodes.forEach((node, index) => {
          const fragment = fragments[index];
          timeline.to(node, {
            x: point[0] - fragment.left + (seeded(index, seed + 7) - 0.5) * 5,
            y: point[1] - fragment.top + (seeded(index, seed + 11) - 0.5) * 5,
            scale: 0.12,
            rotation: (seeded(index, seed + 13) - 0.5) * 45,
            opacity: 0,
            duration,
            ease: "power3.in",
          }, 0);
        });
      }, signal),
    cleanup: (restoreSource) => {
      if (disposed) return;
      disposed = true;
      activeTimeline?.kill();
      overlay.remove();
      element.style.opacity = saved.opacity;
      element.style.filter = saved.filter;
      if (restoreSource) element.style.visibility = saved.visibility;
    },
  };
}

export { MAX_FRAGMENT_GLYPHS };
