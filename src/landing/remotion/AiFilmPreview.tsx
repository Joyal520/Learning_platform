import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { clamp } from "./constants";

export const FILM_PREVIEW_WIDTH = 1280;
export const FILM_PREVIEW_HEIGHT = 720;
export const FILM_PREVIEW_FPS = 30;
export const FILM_PREVIEW_DURATION = 270;

const rainDrops = Array.from({ length: 32 }, (_, index) => ({
  left: (index * 83 + 41) % FILM_PREVIEW_WIDTH,
  length: 18 + ((index * 17) % 30),
  opacity: 0.12 + ((index * 11) % 22) / 100,
  delay: (index * 37) % FILM_PREVIEW_HEIGHT,
}));

const distantLights = [
  { left: 94, top: 232, size: 12, color: "#F4BC6A" },
  { left: 176, top: 266, size: 7, color: "#73CBEA" },
  { left: 255, top: 211, size: 9, color: "#E4A45E" },
  { left: 926, top: 250, size: 8, color: "#A1B7FF" },
  { left: 1048, top: 221, size: 13, color: "#EDB96E" },
  { left: 1144, top: 282, size: 7, color: "#6EBBD6" },
];

export function AiFilmPreview() {
  const frame = useCurrentFrame();
  const loopAngle = (frame / FILM_PREVIEW_DURATION) * Math.PI * 2;
  const sceneOpacity = interpolate(frame, [0, 22, 236, 269], [0, 1, 1, 0], {
    ...clamp,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  });
  const lightStrength = interpolate(frame, [8, 62, 215, 263], [0.15, 0.92, 0.92, 0.15], clamp);
  const cameraScale = interpolate(frame, [0, 138, 238, 269], [1, 1.035, 1.018, 1], {
    ...clamp,
    easing: Easing.bezier(0.37, 0, 0.63, 1),
  });
  const timelineProgress = interpolate(frame, [0, 238, 269], [0, 1, 0], clamp);

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#030713", fontFamily: "Manrope, Arial, sans-serif" }}>
      <div
        style={{
          position: "absolute",
          inset: -16,
          opacity: sceneOpacity,
          scale: cameraScale,
          background: "linear-gradient(180deg, #090F24 0%, #111936 42%, #14182D 66%, #090B15 100%)",
          transformOrigin: "52% 58%",
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 18% 49%, rgba(239, 174, 88, ${0.34 * lightStrength}), transparent 28%), radial-gradient(circle at 71% 38%, rgba(92, 81, 164, 0.22), transparent 34%), linear-gradient(90deg, rgba(2,6,18,.24), transparent 45%, rgba(3,6,18,.18))` }} />

        <div style={{ position: "absolute", left: 0, right: 0, top: 170, height: 246, opacity: 0.92 }}>
          <div style={{ position: "absolute", left: -14, bottom: 0, width: 190, height: 206, background: "#080D1E", clipPath: "polygon(0 24%, 44% 24%, 44% 8%, 70% 8%, 70% 35%, 100% 35%, 100% 100%, 0 100%)" }} />
          <div style={{ position: "absolute", left: 178, bottom: 0, width: 150, height: 248, background: "#0A1024", clipPath: "polygon(0 30%, 25% 30%, 25% 0, 68% 0, 68% 19%, 100% 19%, 100% 100%, 0 100%)" }} />
          <div style={{ position: "absolute", right: 205, bottom: 0, width: 164, height: 220, background: "#090F21", clipPath: "polygon(0 26%, 38% 26%, 38% 7%, 72% 7%, 72% 37%, 100% 37%, 100% 100%, 0 100%)" }} />
          <div style={{ position: "absolute", right: -20, bottom: 0, width: 240, height: 262, background: "#080D1E", clipPath: "polygon(0 21%, 29% 21%, 29% 0, 63% 0, 63% 29%, 100% 29%, 100% 100%, 0 100%)" }} />
        </div>

        {distantLights.map((light, index) => (
          <div
            key={`${light.left}-${light.top}`}
            style={{
              position: "absolute",
              left: light.left,
              top: light.top,
              width: light.size,
              height: light.size,
              opacity: lightStrength * (0.62 + index * 0.05),
              borderRadius: 2,
              background: light.color,
              boxShadow: `0 0 ${22 + light.size * 2}px ${light.color}`,
            }}
          />
        ))}

        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 280, background: "linear-gradient(180deg, #12172A 0%, #090B13 70%)", clipPath: "polygon(0 27%, 100% 0, 100% 100%, 0 100%)" }} />
        <div style={{ position: "absolute", left: -40, right: -40, bottom: 72, height: 8, background: "linear-gradient(90deg, transparent, #46516D 22%, #A67C4A 49%, #3D4660 72%, transparent)", rotate: "-1.9deg", opacity: 0.72 }} />
        <div style={{ position: "absolute", left: -40, right: -40, bottom: 112, height: 2, background: "linear-gradient(90deg, transparent, rgba(235,180,105,.48), transparent)", rotate: "-1.9deg" }} />

        <div style={{ position: "absolute", width: 390, height: 410, left: -72, top: 190, opacity: lightStrength, borderRadius: 999, filter: "blur(34px)", background: "radial-gradient(circle, rgba(245,181,93,.34), rgba(226,144,65,.08) 48%, transparent 72%)" }} />
        <div style={{ position: "absolute", width: 600, height: 110, left: -60 + Math.sin(loopAngle) * 18, bottom: 135, opacity: 0.4, filter: "blur(28px)", background: "linear-gradient(90deg, rgba(166,186,211,.28), rgba(92,91,130,.12), transparent)", borderRadius: 999 }} />
        <div style={{ position: "absolute", width: 720, height: 92, right: -160 + Math.cos(loopAngle) * 22, bottom: 210, opacity: 0.28, filter: "blur(30px)", background: "linear-gradient(90deg, transparent, rgba(154,165,205,.2), rgba(205,184,165,.2))", borderRadius: 999 }} />

        <div style={{ position: "absolute", left: 681 + Math.sin(loopAngle) * 4, bottom: 125 + Math.cos(loopAngle) * 2, width: 72, height: 230, filter: "drop-shadow(0 18px 18px rgba(0,0,0,.45))" }}>
          <div style={{ width: 42, height: 44, marginInline: "auto", borderRadius: "48% 48% 44% 44%", background: "#050712" }} />
          <div style={{ width: 68, height: 156, margin: "3px auto 0", borderRadius: "30px 30px 10px 10px", background: "linear-gradient(90deg, #050711, #0B0D18 48%, #05060D)", clipPath: "polygon(25% 0, 75% 0, 100% 100%, 0 100%)" }} />
          <div style={{ width: 12, height: 46, margin: "-2px 0 0 15px", borderRadius: "0 0 7px 7px", background: "#04050A" }} />
          <div style={{ width: 12, height: 46, margin: "-46px 0 0 45px", borderRadius: "0 0 7px 7px", background: "#04050A" }} />
        </div>

        {rainDrops.map((drop, index) => {
          const travel = (frame * (FILM_PREVIEW_HEIGHT / FILM_PREVIEW_DURATION) + drop.delay) % FILM_PREVIEW_HEIGHT;
          return (
            <div
              key={index}
              style={{
                position: "absolute",
                left: drop.left,
                top: travel - 50,
                width: 1,
                height: drop.length,
                opacity: drop.opacity * sceneOpacity,
                background: "linear-gradient(180deg, transparent, rgba(184,211,238,.84))",
                rotate: "11deg",
              }}
            />
          );
        })}

        <div style={{ position: "absolute", inset: 0, opacity: 0.16 + Math.sin(loopAngle * 3) * 0.025, backgroundImage: "radial-gradient(circle at 20% 30%, #fff 0 0.7px, transparent 0.9px), radial-gradient(circle at 72% 64%, #fff 0 0.6px, transparent 0.8px)", backgroundSize: "13px 17px, 19px 23px", mixBlendMode: "soft-light" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 48%, rgba(1,3,10,.34) 78%, rgba(0,1,7,.78) 100%)" }} />
      </div>

      <div style={{ position: "absolute", top: 0, right: 0, left: 0, height: 48, background: "#02040A" }} />
      <div style={{ position: "absolute", right: 0, bottom: 0, left: 0, height: 48, background: "#02040A" }} />

      <div style={{ position: "absolute", left: 42, top: 78, width: 58, height: 38, borderTop: "2px solid rgba(219,232,244,.58)", borderLeft: "2px solid rgba(219,232,244,.58)" }} />
      <div style={{ position: "absolute", right: 42, top: 78, width: 58, height: 38, borderTop: "2px solid rgba(219,232,244,.58)", borderRight: "2px solid rgba(219,232,244,.58)" }} />
      <div style={{ position: "absolute", left: 42, bottom: 78, width: 58, height: 38, borderBottom: "2px solid rgba(219,232,244,.58)", borderLeft: "2px solid rgba(219,232,244,.58)" }} />
      <div style={{ position: "absolute", right: 42, bottom: 78, width: 58, height: 38, borderBottom: "2px solid rgba(219,232,244,.58)", borderRight: "2px solid rgba(219,232,244,.58)" }} />

      <div style={{ position: "absolute", right: 54, bottom: 58, left: 54, height: 3, overflow: "hidden", borderRadius: 99, background: "rgba(255,255,255,.16)" }}>
        <div style={{ width: `${timelineProgress * 100}%`, height: "100%", borderRadius: 99, background: "linear-gradient(90deg, #3E7BFF, #7B68FF, #50BCD0)" }} />
      </div>
    </AbsoluteFill>
  );
}
