"use client";

import { useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { useReducedMotion } from "@/landing/hooks/useReducedMotion";
import {
  AiFilmPreview,
  FILM_PREVIEW_DURATION,
  FILM_PREVIEW_FPS,
  FILM_PREVIEW_HEIGHT,
  FILM_PREVIEW_WIDTH,
} from "@/landing/remotion/AiFilmPreview";

export function FilmPreviewPlayer() {
  const playerRef = useRef<PlayerRef>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const handleVisibility = () => {
      if (reducedMotion) {
        playerRef.current?.seekTo(146);
        playerRef.current?.pause();
        return;
      }
      if (document.hidden) playerRef.current?.pause();
      else playerRef.current?.play();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    handleVisibility();
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [reducedMotion]);

  return (
    <Player
      ref={playerRef}
      component={AiFilmPreview}
      durationInFrames={FILM_PREVIEW_DURATION}
      fps={FILM_PREVIEW_FPS}
      compositionWidth={FILM_PREVIEW_WIDTH}
      compositionHeight={FILM_PREVIEW_HEIGHT}
      autoPlay={!reducedMotion}
      loop={!reducedMotion}
      initiallyMuted
      controls={false}
      initialFrame={reducedMotion ? 146 : 0}
      style={{ width: "100%", aspectRatio: "16 / 9" }}
      acknowledgeRemotionLicense
    />
  );
}
