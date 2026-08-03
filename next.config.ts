import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    return [
      // Serve the existing SPA at /home
      {
        source: "/home",
        destination: "/app.html",
      },
      // Digital Classroom static alias (preserving existing vercel.json route)
      {
        source: "/digital-classroom-static/:path*",
        destination: "/Digital_classroom/Digital Classroom/:path*",
      },
    ];
  },
};

export default withSerwist(nextConfig);
