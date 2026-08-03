import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Edtechra — Learn Smarter. Teach Better. Create the Future.",
    short_name: "Edtechra",
    description: "AI-powered education and creative learning for students, teachers and creators.",
    start_url: "/home",
    display: "standalone",
    background_color: "#F7FAFF",
    theme_color: "#001040",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/brand/edtechra-app-icon.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/edtechra-app-icon.png",
        sizes: "any",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["education", "productivity"],
  };
}
