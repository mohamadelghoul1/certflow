import type { MetadataRoute } from "next";

// What a phone needs to put Certlyn on its home screen. Opens on the
// dashboard; "On site" is one tap from there on the bottom bar.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Certlyn",
    short_name: "Certlyn",
    description: "Certification project management for NSW building certifiers",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5f7fa",
    theme_color: "#1a3a5f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
