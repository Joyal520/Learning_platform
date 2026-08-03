import { FaFacebookF, FaInstagram, FaYoutube } from "react-icons/fa";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { clamp, showcaseColors } from "../constants";

const channels = [
  { label: "YouTube", icon: FaYoutube, color: "#FF0033", x: 350, y: 565 },
  { label: "Facebook", icon: FaFacebookF, color: "#1877F2", x: 800, y: 670 },
  { label: "Instagram", icon: FaInstagram, color: "#C13584", x: 1250, y: 565 },
];

export function DistributionScene() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [258, 280, 320, 344], [0, 1, 1, 0], clamp);
  const pathProgress = interpolate(frame, [274, 312], [0, 1], clamp);

  return (
    <div style={{ position: "absolute", inset: 0, opacity }}>
      <div style={{ position: "absolute", top: 130, left: 0, right: 0, textAlign: "center" }}>
        <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", color: showcaseColors.blue }}>Learn with Edtechra everywhere</div>
        <div style={{ marginTop: 14, fontSize: 60, fontWeight: 850, color: showcaseColors.navy }}>Create once. Share learning globally.</div>
      </div>
      <svg width="1600" height="1000" viewBox="0 0 1600 1000" style={{ position: "absolute", inset: 0 }}>
        <path d="M800 430 C640 430 520 500 350 565 M800 430 C800 520 800 585 800 670 M800 430 C960 430 1080 500 1250 565" fill="none" stroke="#D9E5F5" strokeWidth="7" strokeLinecap="round" />
        <path d="M800 430 C640 430 520 500 350 565 M800 430 C800 520 800 585 800 670 M800 430 C960 430 1080 500 1250 565" fill="none" stroke="url(#path-gradient)" strokeWidth="7" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - pathProgress} />
        <defs>
          <linearGradient id="path-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor={showcaseColors.blue} />
            <stop offset="0.5" stopColor={showcaseColors.violet} />
            <stop offset="1" stopColor={showcaseColors.cyan} />
          </linearGradient>
        </defs>
      </svg>
      <div style={{ position: "absolute", left: 700, top: 330, width: 200, height: 200, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 58, border: `2px solid ${showcaseColors.line}`, background: "#FFFFFF", boxShadow: "0 26px 70px rgba(0,16,64,0.14)" }}>
        <Img src={staticFile("brand/edtechra-symbol.png")} style={{ width: 150, height: 150, objectFit: "contain", borderRadius: 38 }} />
      </div>
      {channels.map((channel, index) => {
        const Icon = channel.icon;
        const itemProgress = interpolate(frame, [290 + index * 7, 312 + index * 7], [0, 1], clamp);
        return (
          <div key={channel.label} style={{ position: "absolute", left: channel.x - 92, top: channel.y - 92, width: 184, height: 184, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, borderRadius: 48, background: "#FFFFFF", border: `2px solid ${showcaseColors.line}`, boxShadow: "0 22px 56px rgba(0,16,64,0.12)", opacity: itemProgress, scale: 0.78 + itemProgress * 0.22 }}>
            <Icon size={54} color={channel.color} />
            <div style={{ color: showcaseColors.ink, fontSize: 21, fontWeight: 800 }}>{channel.label}</div>
          </div>
        );
      })}
    </div>
  );
}
