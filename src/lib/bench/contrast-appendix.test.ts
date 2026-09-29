import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { BRAND, contrast } from "@/lib/brand";

type Pair = {
  scheme: "Light" | "Dark";
  name: string;
  fg: string;
  bg: string;
  ratio: number;
  needs: number;
  pass: boolean;
};

const light = {
  ink: BRAND.ink,
  body: BRAND.body,
  muted: BRAND.muted,
  canvas: BRAND.canvas,
  surface: BRAND.surface,
  accent: BRAND.accent,
  onAccent: BRAND.onAccent,
  edge: BRAND.edge,
  selEdge: BRAND.selEdge,
  line: "#D3E2E6",
  danger: BRAND.danger,
  success: BRAND.success,
  accentDeep: BRAND.accentDeep,
  tint: BRAND.accentTint,
  header: BRAND.header,
  headerInk: BRAND.headerInk,
};

const dark = {
  ink: BRAND.darkInk,
  body: BRAND.darkBody,
  muted: BRAND.darkMuted,
  canvas: BRAND.darkCanvas,
  surface: BRAND.darkSurface,
  accent: BRAND.accent,
  link: BRAND.accentLight,
  edge: BRAND.darkEdge,
  selEdge: BRAND.darkSelEdge,
  line: "#1E4450",
  danger: BRAND.darkDanger,
  success: BRAND.darkSuccess,
  tint: BRAND.darkAccentTint,
  onAccent: BRAND.onAccent,
  successFill: BRAND.success,
};

/** Appendix A.1 and A.2. Ratios are the ones `tools/contrast.py` printed in the spec. */
const PAIRS: Pair[] = [
  { scheme: "Light", name: "ink on canvas", fg: light.ink, bg: light.canvas, ratio: 14.76, needs: 4.5, pass: true },
  { scheme: "Light", name: "ink on surface", fg: light.ink, bg: light.surface, ratio: 16.53, needs: 4.5, pass: true },
  { scheme: "Light", name: "body on canvas", fg: light.body, bg: light.canvas, ratio: 8.4, needs: 4.5, pass: true },
  { scheme: "Light", name: "body on surface", fg: light.body, bg: light.surface, ratio: 9.4, needs: 4.5, pass: true },
  { scheme: "Light", name: "muted on canvas", fg: light.muted, bg: light.canvas, ratio: 6.5, needs: 4.5, pass: true },
  { scheme: "Light", name: "muted on surface", fg: light.muted, bg: light.surface, ratio: 7.28, needs: 4.5, pass: true },
  { scheme: "Light", name: "link on canvas", fg: light.accent, bg: light.canvas, ratio: 7.24, needs: 4.5, pass: true },
  { scheme: "Light", name: "link on surface", fg: light.accent, bg: light.surface, ratio: 8.11, needs: 4.5, pass: true },
  { scheme: "Light", name: "on-accent on accent", fg: light.onAccent, bg: light.accent, ratio: 8.11, needs: 4.5, pass: true },
  { scheme: "Light", name: "accent vs canvas", fg: light.accent, bg: light.canvas, ratio: 7.24, needs: 3, pass: true },
  { scheme: "Light", name: "accent vs surface", fg: light.accent, bg: light.surface, ratio: 8.11, needs: 3, pass: true },
  { scheme: "Light", name: "edge vs surface", fg: light.edge, bg: light.surface, ratio: 5.13, needs: 3, pass: true },
  { scheme: "Light", name: "edge vs canvas", fg: light.edge, bg: light.canvas, ratio: 4.58, needs: 3, pass: true },
  { scheme: "Light", name: "line vs surface", fg: light.line, bg: light.surface, ratio: 1.31, needs: 3, pass: false },
  { scheme: "Light", name: "focus vs canvas", fg: light.accent, bg: light.canvas, ratio: 7.24, needs: 3, pass: true },
  { scheme: "Light", name: "focus vs surface", fg: light.accent, bg: light.surface, ratio: 8.11, needs: 3, pass: true },
  { scheme: "Light", name: "danger on surface", fg: light.danger, bg: light.surface, ratio: 6.44, needs: 4.5, pass: true },
  { scheme: "Light", name: "danger on canvas", fg: light.danger, bg: light.canvas, ratio: 5.75, needs: 4.5, pass: true },
  { scheme: "Light", name: "success on surface", fg: light.success, bg: light.surface, ratio: 5.56, needs: 4.5, pass: true },
  { scheme: "Light", name: "on-accent on success", fg: light.onAccent, bg: light.success, ratio: 5.56, needs: 4.5, pass: true },
  { scheme: "Light", name: "waiting on tint", fg: light.accentDeep, bg: light.tint, ratio: 10.95, needs: 4.5, pass: true },
  { scheme: "Light", name: "on-accent on danger", fg: light.onAccent, bg: light.danger, ratio: 6.44, needs: 4.5, pass: true },
  { scheme: "Light", name: "header ink on band", fg: light.headerInk, bg: light.header, ratio: 15.75, needs: 4.5, pass: true },
  { scheme: "Light", name: "logo blue on band", fg: "#0040B0", bg: light.header, ratio: 8.22, needs: 3, pass: true },
  { scheme: "Light", name: "logo black on band", fg: "#000000", bg: light.header, ratio: 19.41, needs: 3, pass: true },
  { scheme: "Light", name: "tab active on surface", fg: light.accent, bg: light.surface, ratio: 8.11, needs: 4.5, pass: true },
  { scheme: "Light", name: "tab idle on surface", fg: light.body, bg: light.surface, ratio: 9.4, needs: 4.5, pass: true },
  { scheme: "Light", name: "placeholder on surface", fg: light.muted, bg: light.surface, ratio: 7.28, needs: 4.5, pass: true },
  { scheme: "Dark", name: "ink on canvas", fg: dark.ink, bg: dark.canvas, ratio: 16.09, needs: 4.5, pass: true },
  { scheme: "Dark", name: "ink on surface", fg: dark.ink, bg: dark.surface, ratio: 13.66, needs: 4.5, pass: true },
  { scheme: "Dark", name: "body on canvas", fg: dark.body, bg: dark.canvas, ratio: 12.76, needs: 4.5, pass: true },
  { scheme: "Dark", name: "body on surface", fg: dark.body, bg: dark.surface, ratio: 10.83, needs: 4.5, pass: true },
  { scheme: "Dark", name: "muted on canvas", fg: dark.muted, bg: dark.canvas, ratio: 9.71, needs: 4.5, pass: true },
  { scheme: "Dark", name: "muted on surface", fg: dark.muted, bg: dark.surface, ratio: 8.25, needs: 4.5, pass: true },
  { scheme: "Dark", name: "link on canvas", fg: dark.link, bg: dark.canvas, ratio: 10.92, needs: 4.5, pass: true },
  { scheme: "Dark", name: "link on surface", fg: dark.link, bg: dark.surface, ratio: 9.27, needs: 4.5, pass: true },
  { scheme: "Dark", name: "accent as text on canvas", fg: dark.accent, bg: dark.canvas, ratio: 2.04, needs: 4.5, pass: false },
  { scheme: "Dark", name: "on-accent on accent", fg: dark.onAccent, bg: dark.accent, ratio: 8.11, needs: 4.5, pass: true },
  { scheme: "Dark", name: "accent fill vs canvas", fg: dark.accent, bg: dark.canvas, ratio: 2.04, needs: 3, pass: false },
  { scheme: "Dark", name: "accent fill vs surface", fg: dark.accent, bg: dark.surface, ratio: 1.73, needs: 3, pass: false },
  { scheme: "Dark", name: "sel-edge vs canvas", fg: dark.selEdge, bg: dark.canvas, ratio: 5.15, needs: 3, pass: true },
  { scheme: "Dark", name: "sel-edge vs surface", fg: dark.selEdge, bg: dark.surface, ratio: 4.37, needs: 3, pass: true },
  { scheme: "Dark", name: "edge vs surface", fg: dark.edge, bg: dark.surface, ratio: 4.76, needs: 3, pass: true },
  { scheme: "Dark", name: "edge vs canvas", fg: dark.edge, bg: dark.canvas, ratio: 5.61, needs: 3, pass: true },
  { scheme: "Dark", name: "line vs surface", fg: dark.line, bg: dark.surface, ratio: 1.35, needs: 3, pass: false },
  { scheme: "Dark", name: "focus vs canvas", fg: dark.link, bg: dark.canvas, ratio: 10.92, needs: 3, pass: true },
  { scheme: "Dark", name: "focus vs surface", fg: dark.link, bg: dark.surface, ratio: 9.27, needs: 3, pass: true },
  { scheme: "Dark", name: "danger on surface", fg: dark.danger, bg: dark.surface, ratio: 8.07, needs: 4.5, pass: true },
  { scheme: "Dark", name: "danger on canvas", fg: dark.danger, bg: dark.canvas, ratio: 9.5, needs: 4.5, pass: true },
  { scheme: "Dark", name: "success text on surface", fg: dark.success, bg: dark.surface, ratio: 8.72, needs: 4.5, pass: true },
  { scheme: "Dark", name: "ready on success fill", fg: dark.onAccent, bg: dark.successFill, ratio: 5.56, needs: 4.5, pass: true },
  { scheme: "Dark", name: "waiting on tint", fg: dark.link, bg: dark.tint, ratio: 10, needs: 4.5, pass: true },
  { scheme: "Dark", name: "tab active on surface", fg: dark.link, bg: dark.surface, ratio: 9.27, needs: 4.5, pass: true },
  { scheme: "Dark", name: "tab idle on surface", fg: dark.body, bg: dark.surface, ratio: 10.83, needs: 4.5, pass: true },
  { scheme: "Dark", name: "toast ink on link", fg: BRAND.ink, bg: dark.link, ratio: 10.92, needs: 4.5, pass: true },
  { scheme: "Dark", name: "header ink on band", fg: light.headerInk, bg: light.header, ratio: 15.75, needs: 4.5, pass: true },
  { scheme: "Dark", name: "logo blue on band", fg: "#0040B0", bg: light.header, ratio: 8.22, needs: 3, pass: true },
  { scheme: "Light", name: "new pill", fg: "#003280", bg: "#E3EEFF", ratio: 10.15, needs: 4.5, pass: true },
  { scheme: "Light", name: "waiting on customer", fg: BRAND.ink, bg: "#F4FAFB", ratio: 15.89, needs: 4.5, pass: true },
  { scheme: "Light", name: "collected", fg: BRAND.body, bg: BRAND.canvas, ratio: 8.4, needs: 4.5, pass: true },
  { scheme: "Dark", name: "new pill", fg: "#B7D2FF", bg: "#16324A", ratio: 8.61, needs: 4.5, pass: true },
  { scheme: "Dark", name: "waiting on customer bubble", fg: "#B7D2FF", bg: "#16324A", ratio: 8.61, needs: 4.5, pass: true },
  { scheme: "Dark", name: "collected", fg: BRAND.darkBody, bg: "#16323C", ratio: 10.27, needs: 4.5, pass: true },
  { scheme: "Dark", name: "danger border vs surface", fg: BRAND.darkDanger, bg: dark.surface, ratio: 8.07, needs: 3, pass: true },
  { scheme: "Dark", name: "muted on tint", fg: BRAND.darkMuted, bg: "#102830", ratio: 8.89, needs: 4.5, pass: true },
  { scheme: "Light", name: "muted on tint", fg: BRAND.muted, bg: "#F1F6FF", ratio: 6.81, needs: 4.5, pass: true },
  { scheme: "Dark", name: "ink on surface sheet", fg: BRAND.darkInk, bg: dark.surface, ratio: 13.66, needs: 4.5, pass: true },
  { scheme: "Light", name: "chat ink on soft", fg: BRAND.ink, bg: "#E3EEFF", ratio: 14.32, needs: 4.5, pass: true },
  { scheme: "Dark", name: "chat ink on soft", fg: BRAND.darkInk, bg: "#16324A", ratio: 12.68, needs: 4.5, pass: true },
  { scheme: "Light", name: "link on soft", fg: BRAND.accent, bg: "#E3EEFF", ratio: 7.02, needs: 4.5, pass: true },
  { scheme: "Light", name: "toast canvas on ink", fg: BRAND.canvas, bg: BRAND.ink, ratio: 14.76, needs: 4.5, pass: true },
];

describe("appendix contrast", () => {
  it("reproduces every pair in Appendix A", () => {
    for (const pair of PAIRS) {
      const ratio = contrast(pair.fg, pair.bg);
      expect(ratio, `${pair.scheme} ${pair.name}`).toBeCloseTo(pair.ratio, 2);
      if (pair.pass) {
        expect(ratio, `${pair.scheme} ${pair.name}`).toBeGreaterThanOrEqual(pair.needs);
      } else {
        expect(ratio, `${pair.scheme} ${pair.name}`).toBeLessThan(pair.needs);
      }
    }
  });

  it("keeps the header band above the stated floors", () => {
    expect(contrast("#0B1B3A", "#F4F6FA")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#0040B0", "#F4F6FA")).toBeGreaterThanOrEqual(3);
    expect(contrast(BRAND.headerInk, BRAND.header)).toBeGreaterThanOrEqual(4.5);
  });

  it("publishes edge and sel-edge in both schemes and does not use accent as dark text", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain("--edge: #5b7079");
    expect(css).toContain("--sel-edge: #0048b0");
    const darkTokens = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"), css.indexOf("@theme"));
    expect(darkTokens).toContain("--edge: #7c9aa5");
    expect(darkTokens).toContain("--sel-edge: #5b8fe0");
    expect(darkTokens).toContain("--link: #b7d2ff");
    expect(darkTokens).not.toContain("--link: #0048b0");
    expect(BRAND.edge).toBe("#5B7079");
    expect(BRAND.selEdge).toBe("#0048B0");
    expect(BRAND.darkEdge).toBe("#7C9AA5");
    expect(BRAND.darkSelEdge).toBe("#5B8FE0");
    expect(BRAND.ink).toBe("#0B2029");
    expect(BRAND.accent).toBe("#0048B0");
  });
});
