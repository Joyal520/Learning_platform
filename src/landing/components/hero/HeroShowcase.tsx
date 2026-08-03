"use client";

import { useEffect, useRef } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { useReducedMotion } from "@/landing/hooks/useReducedMotion";
import { EdtechraShowcase } from "@/landing/remotion/EdtechraShowcase";
import { SHOWCASE_DURATION, SHOWCASE_FPS, SHOWCASE_HEIGHT, SHOWCASE_WIDTH } from "@/landing/remotion/constants";

export function HeroShowcase() {
  const playerRef = useRef<PlayerRef>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const handleVisibility = () => {
      if (reducedMotion) {
        playerRef.current?.seekTo(110);
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
    <div className="showcase-shell" aria-label="Animated overview of the Edtechra learning platform">
      <Player
        ref={playerRef}
        component={EdtechraShowcase}
        durationInFrames={SHOWCASE_DURATION}
        fps={SHOWCASE_FPS}
        compositionWidth={SHOWCASE_WIDTH}
        compositionHeight={SHOWCASE_HEIGHT}
        autoPlay={!reducedMotion}
        loop={!reducedMotion}
        initiallyMuted
        controls={false}
        initialFrame={reducedMotion ? 110 : 0}
        style={{ width: "100%", aspectRatio: "16 / 10" }}
        acknowledgeRemotionLicense
      />
      <div className="showcase-caption">
        <span className="showcase-live-dot" aria-hidden="true" />
        A connected learning and creative workspace
      </div>
    </div>
  );
}
