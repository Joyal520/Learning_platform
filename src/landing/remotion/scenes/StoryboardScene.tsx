import { Film, Sparkles, WandSparkles } from "lucide-react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { clamp, showcaseColors } from "../constants";

const scenes = [
  { label: "Idea", caption: "Shape a meaningful story", color: "#DDEBFF", icon: Sparkles },
  { label: "Scene", caption: "Build a consistent visual world", color: "#EAE4FF", icon: WandSparkles },
  { label: "Film", caption: "Edit and prepare to publish", color: "#DDF8FB", icon: Film },
];

export function StoryboardScene() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [170, 194, 258, 284], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: "absolute", inset: 0, padding: "120px 150px", display: "flex", flexDirection: "column", opacity }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 52 }}>
        <div>
          <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", color: showcaseColors.violet }}>AI Short Film School</div>
          <div style={{ marginTop: 15, fontSize: 62, lineHeight: 1.05, fontWeight: 850, color: showcaseColors.navy }}>From idea to publishable film</div>
        </div>
        <div style={{ padding: "14px 20px", borderRadius: 99, border: `2px solid ${showcaseColors.line}`, color: "#475467", fontSize: 20, fontWeight: 700, background: "#FFFFFF" }}>Story workspace</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 26 }}>
        {scenes.map((scene, index) => {
          const Icon = scene.icon;
          const progress = interpolate(frame, [188 + index * 9, 216 + index * 9], [0, 1], {
            ...clamp,
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          });
          return (
            <div key={scene.label} style={{ opacity: progress, translate: `${(1 - progress) * 58}px 0` }}>
              <div style={{ height: 360, position: "relative", overflow: "hidden", borderRadius: 34, border: `2px solid ${showcaseColors.line}`, background: scene.color, boxShadow: "0 24px 60px rgba(0, 16, 64, 0.1)" }}>
                <div style={{ position: "absolute", width: 240, height: 240, right: -60, top: -60, borderRadius: 999, background: "rgba(255,255,255,0.58)" }} />
                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: showcaseColors.navy }}>
                  <Icon size={104} strokeWidth={1.4} />
                </div>
                <div style={{ position: "absolute", left: 24, right: 24, bottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ padding: "10px 15px", borderRadius: 99, color: showcaseColors.navy, fontSize: 18, fontWeight: 800, background: "rgba(255,255,255,0.78)" }}>Scene {index + 1}</span>
                  <span style={{ color: showcaseColors.navy, fontSize: 18, fontWeight: 800 }}>{scene.label}</span>
                </div>
              </div>
              <div style={{ marginTop: 20, fontSize: 24, lineHeight: 1.35, color: "#475467", fontWeight: 650 }}>{scene.caption}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
