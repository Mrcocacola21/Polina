"use client";

import type { ReactNode } from "react";

import { VisualRuntimeProvider } from "@/lib/visuals/VisualRuntimeContext";
import { SoulCollectionProvider } from "@/lib/souls/SoulCollectionContext";
import { SoulHud } from "@/components/souls/SoulHud";
import { SoulCollectionSandbox } from "@/components/souls/SoulCollectionSandbox";

import { CustomCursor } from "./CustomCursor";
import { GlobalFxLayers } from "./GlobalFxLayers";
import { GlobalWebGLCanvas } from "./GlobalWebGLCanvas";
import { VisualSandbox } from "./VisualSandbox";

export function GlobalVisualRoot({
  children,
  visualSandboxEnabled = false,
  soulSandboxEnabled = false,
}: Readonly<{
  children: ReactNode;
  visualSandboxEnabled?: boolean;
  soulSandboxEnabled?: boolean;
}>) {
  return (
    <VisualRuntimeProvider>
      <SoulCollectionProvider>
        <GlobalFxLayers />
        <GlobalWebGLCanvas />
        {children}
        {!visualSandboxEnabled ? <SoulHud /> : null}
        <CustomCursor />
        {visualSandboxEnabled && process.env.NODE_ENV === "development" ? (
          <VisualSandbox />
        ) : null}
        {soulSandboxEnabled && process.env.NODE_ENV === "development" ? (
          <SoulCollectionSandbox />
        ) : null}
      </SoulCollectionProvider>
    </VisualRuntimeProvider>
  );
}
