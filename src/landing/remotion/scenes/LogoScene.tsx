import { Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { clamp, showcaseColors } from "../constants";

export function LogoScene() {
  const frame = useCurrentFrame();
  const isReturn = frame >= 300;
  const localFrame = isReturn ? frame - 300 : frame;
  const reveal = interpolate(localFrame, [0, 28], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const opacity = isReturn
    ? interpolate(frame, [318, 336, 355, 359], [0, 1, 0.8, 0], clamp)
    : interpolate(frame, [0, 12, 52, 68], [0, 1, 1, 0], clamp);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
      }}
    >
      <div
        style={{
          width: 980,
          height: 310,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          clipPath: `inset(0 ${100 - reveal * 100}% 0 0 round 32px)`,
          background: showcaseColors.surface,
          borderRadius: 40,
          boxShadow: "0 30px 90px rgba(0, 16, 64, 0.14)",
          border: `2px solid ${showcaseColors.line}`,
          overflow: "hidden",
        }}
      >
        <Img
          src={staticFile("brand/edtechra-wordmark.png")}
          style={{ width: 900, height: "auto", objectFit: "contain" }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          width: 960 * reveal,
          height: 3,
          left: 320,
          top: 690,
          borderRadius: 99,
          background: `linear-gradient(90deg, ${showcaseColors.blue}, ${showcaseColors.violet}, ${showcaseColors.cyan})`,
          boxShadow: `0 0 24px ${showcaseColors.cyan}80`,
        }}
      />
    </div>
  );
}
