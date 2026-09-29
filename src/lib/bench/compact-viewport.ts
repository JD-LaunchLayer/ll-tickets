import type { Viewport } from "next";
import { BRAND } from "@/lib/brand";

/**
 * Status-bar colour for compact top-bar screens.
 * Jobs, sign-in, error and not-found keep the root layout's light band colour.
 */
export const compactViewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND.canvas },
    { media: "(prefers-color-scheme: dark)", color: BRAND.darkCanvas },
  ],
};
