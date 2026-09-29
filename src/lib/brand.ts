/** LaunchLayer colour tokens. Dark-mode text tints exist so pairs stay WCAG AA. */

export const BRAND = {
  ink: "#0B2029",
  body: "#364851",
  muted: "#49585F",
  surface: "#FBFEFE",
  surface2: "#F4FAFB",
  canvas: "#EAF2F3",
  accent: "#0048B0",
  accentHover: "#013A8F",
  accentDeep: "#003280",
  accentSoft: "#E3EEFF",
  accentTint: "#F1F6FF",
  success: "#137738",
  danger: "#B02A2D",
  accentLight: "#B7D2FF",
  /** Light header. Matches `surface` so the black "Launch" ink reads. */
  header: "#FBFEFE",
  /** Dark-scheme header. The logo sits on `logoPlate`, not on this colour. */
  darkHeader: "#000000",
  /** Fixed light plate. Must not follow the dark-scheme surface token. */
  logoPlate: "#FBFEFE",
  onAccent: "#FBFEFE",
  darkInk: "#F7FBFC",
  darkBody: "#D5E3E8",
  darkMuted: "#B7C8CE",
  darkSurface: "#132E38",
  darkSurface2: "#16323C",
  darkCanvas: "#0B2029",
  darkDanger: "#F0B4B5",
  darkSuccess: "#8FDBA8",
  themeColor: "#FBFEFE",
  themeColorDark: "#000000",
} as const;

/**
 * Tight crop of `public/brand/image-0961fde4.png` (640×307), in source pixels.
 * Drops the empty transparent margin and keeps Launch, the node, and Layer.
 */
export const LOGO_CROP = {
  x: 22,
  y: 30,
  width: 595,
  height: 269,
  sourceWidth: 640,
  sourceHeight: 307,
} as const;

function channel(hex: string, index: number): number {
  return Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
}

function linear(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return (
    0.2126 * linear(channel(hex, 0)) +
    0.7152 * linear(channel(hex, 1)) +
    0.0722 * linear(channel(hex, 2))
  );
}

/** WCAG contrast ratio. 4.5 is AA for normal text. */
export function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}
