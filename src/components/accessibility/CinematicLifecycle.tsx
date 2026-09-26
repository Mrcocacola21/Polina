"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";

import { useCapabilities } from "@/lib/accessibility/CapabilityContext";
import { useAudioEngine } from "@/lib/audio/AudioEngineContext";
import { safePlayVideo } from "@/lib/media/preloaders";

const RESUME_GRACE_MS = 180;

export function CinematicLifecycle() {
  const { visibility, simulatedAudioUnavailable } = useCapabilities();
  const audio = useAudioEngine();
  const pausedVideos = useRef(new Set<HTMLVideoElement>());
  const timelineWasPaused = useRef(false);
  const [soundResumeRequired, setSoundResumeRequired] = useState(false);

  useEffect(() => {
    audio.setDevelopmentUnavailable(simulatedAudioUnavailable);
  }, [audio, simulatedAudioUnavailable]);

  useEffect(() => {
    let resumeTimer = 0;
    if (visibility === "hidden") {
      timelineWasPaused.current = gsap.globalTimeline.paused();
      gsap.globalTimeline.pause();
      pausedVideos.current.clear();
      document.querySelectorAll<HTMLVideoElement>("video[data-soulbound-video]").forEach((video) => {
        if (!video.paused) pausedVideos.current.add(video);
        video.pause();
      });
      void audio.suspendForVisibility();
      return;
    }

    resumeTimer = window.setTimeout(() => {
      if (!timelineWasPaused.current) gsap.globalTimeline.resume();
      void audio.resumeAfterVisibility().then((resumed) => setSoundResumeRequired(!resumed));
      for (const video of pausedVideos.current) {
        if (video.isConnected) void safePlayVideo(video);
      }
      pausedVideos.current.clear();
    }, RESUME_GRACE_MS);
    return () => window.clearTimeout(resumeTimer);
  }, [audio, visibility]);

  if (!soundResumeRequired) return null;
  return (
    <button
      type="button"
      className="sound-resume-affordance"
      onClick={() => void audio.unlockAudio().then((result) => setSoundResumeRequired(!result.ok))}
    >
      Возобновить звук
    </button>
  );
}
