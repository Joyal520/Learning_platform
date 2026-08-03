import {
  BookOpen,
  BriefcaseBusiness,
  ClipboardCheck,
  MessageSquareText,
  Radio,
  Trophy,
} from "lucide-react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, showcaseColors } from "../constants";

const cards = [
  { label: "Digital Classroom", icon: BookOpen, accent: showcaseColors.blue },
  { label: "Live Quiz", icon: Radio, accent: showcaseColors.cyan },
  { label: "AI Feedback", icon: MessageSquareText, accent: showcaseColors.violet },
  { label: "Examinations", icon: ClipboardCheck, accent: showcaseColors.navy },
  { label: "Competitions", icon: Trophy, accent: "#F59E0B" },
  { label: "Portfolio", icon: BriefcaseBusiness, accent: "#F0448B" },
];

export function DashboardScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [54, 76, 164, 190], [0, 1, 1, 0], clamp);
  const shellScale = spring({
    frame: frame - 54,
    fps,
    durationInFrames: 38,
    config: { damping: 18, stiffness: 120, mass: 0.9 },
  });

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity }}>
      <div
        style={{
          width: 1220,
          height: 720,
          padding: 34,
          display: "grid",
          gridTemplateRows: "88px 1fr",
          gap: 24,
          background: "rgba(255,255,255,0.94)",
          border: `2px solid ${showcaseColors.line}`,
          borderRadius: 44,
          boxShadow: "0 48px 120px rgba(0, 28, 94, 0.16)",
          scale: 0.9 + shellScale * 0.1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, background: `linear-gradient(145deg, ${showcaseColors.blue}, ${showcaseColors.violet})` }} />
            <div>
              <div style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 800, color: showcaseColors.navy }}>Learning workspace</div>
              <div style={{ marginTop: 7, fontSize: 19, color: "#667085" }}>Your tools, activities and progress in one place</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: showcaseColors.blue, fontSize: 19, fontWeight: 700 }}>
            <div style={{ width: 10, height: 10, borderRadius: 99, background: showcaseColors.cyan }} /> Connected
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {cards.map((card, index) => {
            const Icon = card.icon;
            const cardProgress = interpolate(frame, [68 + index * 5, 88 + index * 5], [0, 1], {
              ...clamp,
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            });
            return (
              <div
                key={card.label}
                style={{
                  minHeight: 220,
                  padding: 28,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  borderRadius: 28,
                  background: index === 0 ? "linear-gradient(145deg, #F0F6FF, #FFFFFF)" : "#FFFFFF",
                  border: `2px solid ${index === 0 ? "#BFD2FF" : showcaseColors.line}`,
                  boxShadow: "0 15px 40px rgba(16, 24, 40, 0.07)",
                  opacity: cardProgress,
                  translate: `0 ${(1 - cardProgress) * 36}px`,
                }}
              >
                <div style={{ width: 58, height: 58, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 18, color: card.accent, background: `${card.accent}14` }}>
                  <Icon size={31} strokeWidth={2.2} />
                </div>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 750, color: showcaseColors.ink }}>{card.label}</div>
                  <div style={{ height: 7, marginTop: 18, borderRadius: 99, background: "#EAF0F7", overflow: "hidden" }}>
                    <div style={{ width: `${44 + index * 7}%`, height: "100%", borderRadius: 99, background: card.accent }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
