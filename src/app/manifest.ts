import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LaunchLayer jobs",
    short_name: "Jobs",
    description: "Workshop jobs for LaunchLayer, Wickford.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: BRAND.header,
    theme_color: BRAND.themeColor,
    lang: "en-GB",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
