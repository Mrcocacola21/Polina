"use client";

import type { ReactNode } from "react";
import dynamic from "next/dynamic";

import { VisualRuntimeProvider } from "@/lib/visuals/VisualRuntimeContext";
import { SoulCollectionProvider } from "@/lib/souls/SoulCollectionContext";
import { SoulHud } from "@/components/souls/SoulHud";
import { TransitionBridgeLayer } from "@/components/cinematic/TransitionBridgeLayer";
import { TransitionRuntimeProvider } from "@/lib/cinematic/TransitionRuntimeContext";

import { CustomCursor } from "./CustomCursor";
import { GlobalFxLayers } from "./GlobalFxLayers";
import { GlobalWebGLCanvas } from "./GlobalWebGLCanvas";
import { MotionPreference } from "./MotionPreference";

const VisualSandbox = dynamic(() => import("./VisualSandbox").then((module) => module.VisualSandbox), { ssr: false });
const SoulCollectionSandbox = dynamic(() => import("@/components/souls/SoulCollectionSandbox").then((module) => module.SoulCollectionSandbox), { ssr: false });

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
      <MotionPreference />
      <SoulCollectionProvider>
        <TransitionRuntimeProvider>
          <GlobalFxLayers />
          <GlobalWebGLCanvas />
          {children}
          {!visualSandboxEnabled ? <SoulHud /> : null}
          <TransitionBridgeLayer />
          <CustomCursor />
          {visualSandboxEnabled && process.env.NODE_ENV === "development" ? (
            <VisualSandbox />
          ) : null}
          {soulSandboxEnabled && process.env.NODE_ENV === "development" ? (
            <SoulCollectionSandbox />
          ) : null}
        </TransitionRuntimeProvider>
      </SoulCollectionProvider>
    </VisualRuntimeProvider>
  );
}
