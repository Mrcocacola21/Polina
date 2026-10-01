import { SceneDirector } from "@/components/cinematic/SceneDirector";
import { AssetDiagnostics } from "@/components/foundation/AssetDiagnostics";
import { FullscreenStage } from "@/components/foundation/FullscreenStage";
import { GlobalVisualRoot } from "@/components/visuals/GlobalVisualRoot";
import { CapabilityProvider } from "@/lib/accessibility/CapabilityContext";
import { AudioEngineProvider } from "@/lib/audio/AudioEngineContext";
import { MediaPreloadProvider } from "@/lib/media/MediaPreloadContext";

type HomeProps = {
  searchParams: Promise<{
    debug?: string | string[];
    visualSandbox?: string | string[];
    soulSandbox?: string | string[];
    requiemSandbox?: string | string[];
    transitionLab?: string | string[];
    failureLab?: string | string[];
    fractureLab?: string | string[];
  }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const { debug, visualSandbox, soulSandbox, requiemSandbox, transitionLab, failureLab, fractureLab } = await searchParams;
  const debugEnabled =
    process.env.NODE_ENV === "development" && debug === "1";
  const visualSandboxEnabled = debugEnabled && visualSandbox === "1";
  const soulSandboxEnabled = debugEnabled && soulSandbox === "1";
  const requiemSandboxEnabled = debugEnabled && requiemSandbox === "1";
  const transitionLabEnabled = debugEnabled && transitionLab === "1";
  const failureLabEnabled = debugEnabled && failureLab === "1";
  const fractureLabEnabled = debugEnabled && fractureLab === "1";
  const anySandboxEnabled = visualSandboxEnabled || soulSandboxEnabled;

  return (
    <FullscreenStage>
      <CapabilityProvider>
        <MediaPreloadProvider>
          <AudioEngineProvider>
            <GlobalVisualRoot
              visualSandboxEnabled={visualSandboxEnabled}
              soulSandboxEnabled={soulSandboxEnabled}
            >
              <SceneDirector
                debugEnabled={debugEnabled && !anySandboxEnabled}
                sandboxEnabled={anySandboxEnabled}
                requiemSandboxEnabled={requiemSandboxEnabled}
                transitionLabEnabled={transitionLabEnabled}
                failureLabEnabled={failureLabEnabled}
                fractureLabEnabled={fractureLabEnabled}
              />
            </GlobalVisualRoot>
          </AudioEngineProvider>
        </MediaPreloadProvider>
      </CapabilityProvider>
      {debugEnabled && !anySandboxEnabled && !transitionLabEnabled && !fractureLabEnabled ? <AssetDiagnostics /> : null}
    </FullscreenStage>
  );
}
