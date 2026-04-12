import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SEACE Chat",
    short_name: "SEACE Chat",
    description: "Chat inteligente para buscar contrataciones publicas y continuar flujos de cotizacion.",
    start_url: "/chat",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#0f172a",
    categories: ["business", "productivity", "utilities"],
    lang: "es-PE",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/maskable-icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/icons/screenshot-mobile.svg",
        sizes: "1080x1920",
        type: "image/svg+xml",
        form_factor: "narrow",
        label: "Flujo movil de contrataciones",
      },
    ],
  };
}
