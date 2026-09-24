import gsap from "gsap";

export type PointSourceOverlay = Readonly<{
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

export function createPointSourceOverlay(
  points: readonly (readonly [number, number])[],
  convergence: readonly [number, number],
): PointSourceOverlay | null {
  const safePoints = points.filter(
    ([x, y]) => Number.isFinite(x) && Number.isFinite(y),
  );
  if (safePoints.length === 0) return null;

  const left = Math.min(...safePoints.map(([x]) => x));
  const right = Math.max(...safePoints.map(([x]) => x));
  const top = Math.min(...safePoints.map(([, y]) => y));
  const bottom = Math.max(...safePoints.map(([, y]) => y));
  const sourceRect = new DOMRect(
    left,
    top,
    Math.max(1, right - left),
    Math.max(1, bottom - top),
  );
  const overlay = document.createElement("div");
  overlay.dataset.soulPointsOverlay = "true";
  overlay.setAttribute("aria-hidden", "true");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "60",
    pointerEvents: "none",
    overflow: "hidden",
  });

  const nodes = safePoints.flatMap(([x, y], pointIndex) =>
    Array.from({ length: 7 }, (_, moteIndex) => {
      const mote = document.createElement("span");
      const angle = (Math.PI * 2 * moteIndex) / 7 + pointIndex * 0.7;
      const radius = moteIndex === 0 ? 0 : 8 + (moteIndex % 3) * 5;
      Object.assign(mote.style, {
        position: "fixed",
        left: `${x + Math.cos(angle) * radius}px`,
        top: `${y + Math.sin(angle) * radius}px`,
        width: moteIndex === 0 ? "6px" : "3px",
        height: moteIndex === 0 ? "6px" : "3px",
        margin: "-2px 0 0 -2px",
        borderRadius: "50%",
        background: moteIndex % 3 === 0 ? "#f5e5e8" : "#d72b47",
        boxShadow: "0 0 12px rgb(222 36 64 / 0.72)",
        opacity: "0",
        willChange: "transform, opacity, filter",
      });
      overlay.appendChild(mote);
      return { mote, origin: [x, y] as const, pointIndex, moteIndex };
    }),
  );

  const host =
    document.querySelector<HTMLElement>("[data-cinematic-stage]") ??
    document.body;
  host.appendChild(overlay);
  let activeTimeline: gsap.core.Timeline | undefined;
  let disposed = false;

  return {
    sourceRect,
    convergence,
    fragmentCount: nodes.length,
    glow: (duration, intensity, signal) =>
      animateTimeline((timeline) => {
        activeTimeline = timeline;
        timeline.to(
          nodes.map(({ mote }) => mote),
          {
            opacity: (index: number) => (index % 7 === 0 ? 0.95 : 0.55),
            scale: 1 + intensity * 0.22,
            duration,
            stagger: 0.018,
            ease: "sine.inOut",
          },
        );
      }, signal),
    fragment: (duration, signal) =>
      animateTimeline((timeline) => {
        activeTimeline = timeline;
        nodes.forEach(({ mote, pointIndex, moteIndex }) => {
          const angle = pointIndex * 2.05 + moteIndex * 0.78;
          timeline.to(
            mote,
            {
              x: Math.cos(angle) * (10 + moteIndex * 2),
              y: Math.sin(angle) * (8 + moteIndex * 1.5),
              opacity: moteIndex === 0 ? 1 : 0.72,
              duration,
              ease: "power2.out",
            },
            0,
          );
        });
      }, signal),
    converge: (point, duration, signal) =>
      animateTimeline((timeline) => {
        activeTimeline = timeline;
        nodes.forEach(({ mote, origin, pointIndex, moteIndex }) => {
          const curl = (pointIndex - 1) * 18 + (moteIndex - 3) * 1.8;
          timeline.to(
            mote,
            {
              x: point[0] - origin[0] + curl,
              y: point[1] - origin[1] - curl * 0.35,
              scale: moteIndex === 0 ? 0.7 : 0.12,
              opacity: 0,
              duration,
              ease: "power3.in",
            },
            pointIndex * 0.035,
          );
        });
      }, signal),
    cleanup: () => {
      if (disposed) return;
      disposed = true;
      activeTimeline?.kill();
      overlay.remove();
    },
  };
}
