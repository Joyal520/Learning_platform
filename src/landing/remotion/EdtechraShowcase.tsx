import { AbsoluteFill, useCurrentFrame } from "remotion";
import { SHOWCASE_DURATION, showcaseColors } from "./constants";
import { DashboardScene } from "./scenes/DashboardScene";
import { DistributionScene } from "./scenes/DistributionScene";
import { LogoScene } from "./scenes/LogoScene";
import { StoryboardScene } from "./scenes/StoryboardScene";

export function EdtechraShowcase() {
  const frame = useCurrentFrame();
  const angle = (frame / SHOWCASE_DURATION) * Math.PI * 2;

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        background: `radial-gradient(circle at 78% 18%, #E8E2FF 0, transparent 31%), radial-gradient(circle at 18% 82%, #DDF8FB 0, transparent 34%), linear-gradient(145deg, ${showcaseColors.softBlue}, #FFFFFF 52%, ${showcaseColors.softViolet})`,
        fontFamily: "Manrope, Arial, sans-serif",
      }}
    >
      <div style={{ position: "absolute", inset: 0, opacity: 0.55, backgroundImage: "linear-gradient(rgba(36,107,253,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(36,107,253,0.07) 1px, transparent 1px)", backgroundSize: "64px 64px" }} />
      <div style={{ position: "absolute", width: 420, height: 420, left: 80 + Math.cos(angle) * 22, top: 90 + Math.sin(angle) * 20, borderRadius: 999, filter: "blur(70px)", background: "rgba(36,107,253,0.12)" }} />
      <div style={{ position: "absolute", width: 360, height: 360, right: 70 + Math.sin(angle) * 18, bottom: 60 + Math.cos(angle) * 22, borderRadius: 999, filter: "blur(70px)", background: "rgba(112,96,255,0.14)" }} />
      <LogoScene />
      <DashboardScene />
      <StoryboardScene />
      <DistributionScene />
    </AbsoluteFill>
  );
}
