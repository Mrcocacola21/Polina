export type VideoFallbackPolicy = Readonly<{
  semanticRef: string;
  kind: "poster" | "atmosphere";
  fallbackSemanticRef?: string;
  description: string;
}>;

export const VIDEO_FALLBACK_POLICIES: readonly VideoFallbackPolicy[] = Object.freeze([
  { semanticRef: "visual:global.asset04VariantA", kind: "atmosphere", description: "static neutral fog gradient" },
  { semanticRef: "visual:global.asset04VariantB", kind: "atmosphere", description: "static crimson fog gradient" },
  { semanticRef: "visual:global.asset04VariantC", kind: "atmosphere", description: "static heavy fog gradient" },
  { semanticRef: "visual:screens.polinaCircle", kind: "poster", fallbackSemanticRef: "visual:screens.polina", description: "canonical Polina still" },
  { semanticRef: "visual:sections.section09Asset02", kind: "atmosphere", description: "CSS rain and dark atmospheric field" },
  { semanticRef: "visual:requirements.asset04", kind: "atmosphere", description: "CSS radial Requiem release" },
]);

export function fallbackForSemanticRefs(refs: readonly string[]): VideoFallbackPolicy | null {
  return VIDEO_FALLBACK_POLICIES.find((policy) => refs.includes(policy.semanticRef)) ?? null;
}
