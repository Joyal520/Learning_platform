import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/home",
    name: "Edtechra — Learn Smarter. Teach Better. Create the Future.",
    short_name: "Edtechra",
    description: "AI-powered education and creative learning for students, teachers and creators.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    background_color: "#F7FAFF",
    theme_color: "#001040",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/brand/edtechra-app-icon.png",
        sizes: "1254x1254",
        type: "image/png",
        purpose: "any",
      },
    ],
    screenshots: [
      {
        src: "/icons/screenshot-desktop.png",
        sizes: "1920x1080",
        type: "image/png",
        form_factor: "wide",
        label: "Edtechra desktop dashboard",
      },
      {
        src: "/icons/screenshot-mobile.png",
        sizes: "1080x1920",
        type: "image/png",
        form_factor: "narrow",
        label: "Edtechra mobile learning view",
      },
    ] as unknown as MetadataRoute.Manifest["screenshots"],
    categories: ["education", "productivity"],
  };
}
