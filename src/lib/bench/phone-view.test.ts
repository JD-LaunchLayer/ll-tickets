import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { splitReply } from "@/lib/assistant/reply";
import { BRAND, contrast } from "@/lib/brand";
import { emptyListMessage, filterActiveJobs, parseBenchView } from "@/lib/bench/filters";
import { tabCurrent } from "@/lib/bench/tabs";
import type { BenchListRow } from "@/lib/bench/jobs";

function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const row = (status: BenchListRow["status"], ref: string): BenchListRow => ({
  ref,
  customerName: "Ada",
  deviceLabel: "MacBook",
  status,
  nextMove: "Next",
});

describe("phone view", () => {
  it("keeps AA contrast on the pairs the screens use", () => {
    const pairs: Array<[string, string]> = [
      [BRAND.ink, BRAND.surface],
      [BRAND.body, BRAND.surface],
      [BRAND.muted, BRAND.surface],
      [BRAND.muted, BRAND.canvas],
      [BRAND.body, BRAND.canvas],
      [BRAND.onAccent, BRAND.accent],
      [BRAND.onAccent, BRAND.accentHover],
      [BRAND.onAccent, BRAND.success],
      [BRAND.onAccent, BRAND.danger],
      [BRAND.accentDeep, BRAND.accentSoft],
      [BRAND.accentDeep, BRAND.accentTint],
      [BRAND.accent, BRAND.surface],
      [BRAND.accentLight, BRAND.header],
      [BRAND.darkInk, BRAND.darkSurface],
      [BRAND.darkBody, BRAND.darkSurface],
      [BRAND.darkMuted, BRAND.darkSurface],
      [BRAND.darkInk, BRAND.darkCanvas],
      [BRAND.accentLight, BRAND.darkCanvas],
      [BRAND.accentLight, BRAND.darkSurface],
      [BRAND.darkDanger, BRAND.darkSurface],
      [BRAND.darkSuccess, BRAND.darkSurface],
      [BRAND.darkDanger, BRAND.darkCanvas],
    ];
    for (const [foreground, background] of pairs) {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("ships the logo, icon sizes, manifest colours, safe area, and 48px targets", () => {
    expect(pngSize("public/brand/image-0961fde4.png")).toEqual({ width: 640, height: 307 });
    expect(pngSize("public/icons/icon-192.png")).toEqual({ width: 192, height: 192 });
    expect(pngSize("public/icons/icon-512.png")).toEqual({ width: 512, height: 512 });
    expect(pngSize("public/icons/icon-maskable-512.png")).toEqual({ width: 512, height: 512 });
    expect(pngSize("public/icons/apple-touch-icon.png")).toEqual({ width: 180, height: 180 });

    const manifest = readFileSync("src/app/manifest.ts", "utf8");
    expect(manifest).toContain('purpose: "any"');
    expect(manifest).toContain('purpose: "maskable"');
    expect(manifest).toContain("icon-192.png");
    expect(manifest).toContain("icon-512.png");
    expect(manifest).toContain("icon-maskable-512.png");
    expect(manifest).toContain("BRAND.themeColor");
    expect(manifest).toContain("BRAND.header");
    expect(manifest).toContain('lang: "en-GB"');
    expect(manifest).toContain('display: "standalone"');

    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain("safe-area-inset-top");
    expect(css).toContain("safe-area-inset-bottom");
    expect(css).toContain("safe-area-inset-left");
    expect(css).toContain("safe-area-inset-right");
    expect(css).toContain("prefers-color-scheme: dark");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("min-height: 48px");
    expect(css).toContain("min-width: 48px");
    for (const token of ["#0b2029", "#364851", "#49585f", "#0048b0", "#b7d2ff", "#137738", "#b02a2d"]) {
      expect(css).toContain(token);
    }
  });

  it("marks the right tab and filters the bench list without dropping finished", () => {
    expect(tabCurrent("/", "jobs")).toBe(true);
    expect(tabCurrent("/jobs/LL-4K7M", "jobs")).toBe(true);
    expect(tabCurrent("/jobs/LL-4K7M/ask", "ask")).toBe(true);
    expect(tabCurrent("/jobs/LL-4K7M/ask", "jobs")).toBe(false);
    expect(tabCurrent("/jobs/new", "new")).toBe(true);
    expect(tabCurrent("/ask", "ask")).toBe(true);

    const rows = [
      row("diagnosing", "LL-AAAA"),
      row("waiting_on_parts", "LL-BBBB"),
      row("ready", "LL-CCCC"),
    ];
    expect(parseBenchView(undefined)).toBe("bench");
    expect(parseBenchView("nope")).toBe("bench");
    expect(filterActiveJobs(rows, "bench")).toHaveLength(3);
    expect(filterActiveJobs(rows, "parts").map((item) => item.ref)).toEqual(["LL-BBBB"]);
    expect(filterActiveJobs(rows, "ready").map((item) => item.ref)).toEqual(["LL-CCCC"]);
    expect(emptyListMessage("parts")).toBe("No jobs waiting on parts.");
    expect(emptyListMessage("ready")).toBe("No jobs ready.");
  });

  it("turns a diagnosis into paragraphs and lists", () => {
    const blocks = splitReply("Likely the charger.\n\n- Measure the DC jack\n- Then the board\n\n1. 20V means the brick is fine\n2. 0V means open the jack");
    expect(blocks).toEqual([
      { type: "p", text: "Likely the charger." },
      { type: "ul", items: ["Measure the DC jack", "Then the board"] },
      { type: "ol", items: ["20V means the brick is fine", "0V means open the jack"] },
    ]);
  });
});