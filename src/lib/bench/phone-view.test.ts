import { readFileSync } from "fs";
import { inflateSync } from "zlib";
import { describe, expect, it } from "vitest";
import { splitReply } from "@/lib/assistant/reply";
import { BRAND, contrast, LOGO_CROP } from "@/lib/brand";
import { emptyListMessage, filterActiveJobs, parseBenchView } from "@/lib/bench/filters";
import { tabCurrent } from "@/lib/bench/tabs";
import type { BenchListRow } from "@/lib/bench/jobs";

function readPng(path: string): { width: number; height: number; channels: number; pixels: Uint8Array } {
  const data = readFileSync(path);
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat: Buffer[] = [];
  while (pos < data.length) {
    const length = data.readUInt32BE(pos);
    const type = data.toString("ascii", pos + 4, pos + 8);
    const chunk = data.subarray(pos + 8, pos + 8 + length);
    pos += 12 + length;
    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      colorType = chunk[9];
    } else if (type === "IDAT") {
      idat.push(chunk);
    } else if (type === "IEND") {
      break;
    }
  }
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = new Uint8Array(width * height * channels);
  let i = 0;
  const prev = new Uint8Array(stride);
  const row = new Uint8Array(stride);
  const paeth = (a: number, b: number, c: number) => {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    return pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y += 1) {
    const filter = raw[i];
    i += 1;
    row.set(raw.subarray(i, i + stride));
    i += stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? row[x - channels] : 0;
      const up = prev[x];
      const ul = x >= channels ? prev[x - channels] : 0;
      if (filter === 1) row[x] = (row[x] + left) & 255;
      else if (filter === 2) row[x] = (row[x] + up) & 255;
      else if (filter === 3) row[x] = (row[x] + ((left + up) >> 1)) & 255;
      else if (filter === 4) row[x] = (row[x] + paeth(left, up, ul)) & 255;
    }
    pixels.set(row, y * stride);
    prev.set(row);
  }
  return { width, height, channels, pixels };
}

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
      [BRAND.accent, BRAND.header],
      [BRAND.ink, BRAND.header],
      [BRAND.headerInk, BRAND.header],
      ["#000000", BRAND.header],
      ["#0040B0", BRAND.header],
      [BRAND.accentLight, BRAND.darkAccentTint],
      [BRAND.ink, BRAND.accentLight],
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

    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain("--header: #f4f6fa");
    expect(css).toContain("--header-line: #d5dce8");
    expect(css).toContain("--header-ink: #0b1b3a");
    expect(css.match(/--header:\s*#[0-9a-f]+/g)).toEqual(["--header: #f4f6fa"]);
    expect(css).not.toContain("logo-plate");
    expect(css).not.toContain("--header: #000000");
    const darkTokens = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"), css.indexOf("@theme"));
    expect(darkTokens).not.toContain("--header");
    expect(css).toMatch(/\.app-header\s*\{[^}]*background:\s*var\(--header\)/);
    expect(css).toMatch(/\.app-header\s*\{[^}]*border-bottom:\s*1px solid var\(--header-line\)/);
    expect(css).toMatch(/\.app-header\s*\{[^}]*padding-top:\s*env\(safe-area-inset-top\)/);
    expect(css).toMatch(/\.app-header\s*\{[^}]*padding-left:\s*max\(1rem, env\(safe-area-inset-left\)\)/);
    expect(css).toMatch(/\.app-scroll\s*\{[^}]*padding-left:\s*max\(1rem, env\(safe-area-inset-left\)\)/);
    expect(css).toMatch(/\.header-action\s*\{[^}]*color:\s*var\(--header-ink\)/);
    expect(css).toMatch(/\.header-action,[\s\S]*?min-height:\s*48px/);
    expect(css).toMatch(/\.header-action,[\s\S]*?min-width:\s*48px/);
    expect(css).toMatch(/\.tab-link,[\s\S]*?min-height:\s*48px/);
    expect(css).toMatch(/\.app-header :focus-visible\s*\{[^}]*outline-color:\s*var\(--header-ink\)/);
    expect(css).toMatch(/\.brand-logo\s*\{[^}]*height:\s*34px/);
    expect(css).not.toMatch(/\.brand-home\s*\{[^}]*(background|border-radius|box-shadow)/);
    expect(css).not.toContain("408 / 280");
    expect(css).toMatch(/\.search-field input::placeholder\s*\{[^}]*color:\s*var\(--muted\)/);
    expect(css).toMatch(/\.search-field input::placeholder\s*\{[^}]*opacity:\s*1/);
    expect(css).toMatch(/\.tech-btn-primary\s*\{[^}]*border:\s*1px solid var\(--sel-edge\)/);
    expect(css).toMatch(/\.tech-btn-secondary\s*\{[^}]*border:\s*1px solid var\(--edge\)/);
    expect(css).toMatch(/\.field input,[\s\S]*?border:\s*1px solid var\(--edge\)/);
    expect(css).toMatch(/\.tab-link\[aria-current="page"\]\s*\{[^}]*background:\s*transparent/);
    expect(css).toMatch(/\.tab-bar\s*\{[^}]*padding-bottom:\s*env\(safe-area-inset-bottom\)/);
    expect(css).toMatch(/\.top-bar\s*\{[^}]*padding-top:\s*env\(safe-area-inset-top\)/);
    expect(css).toContain(BRAND.darkAccentTint.toLowerCase());
    expect(css).toMatch(/\.toast\s*\{[^}]*color:\s*#0b2029/);

    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout.match(/BRAND\.themeColor/g)).toHaveLength(2);
    expect(layout).not.toContain("themeColorDark");
    expect(layout).toContain('media: "(prefers-color-scheme: light)"');
    expect(layout).toContain('media: "(prefers-color-scheme: dark)"');
    expect(layout).toContain('statusBarStyle: "default"');

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

  it("crops the lockup onto the light band so Launch and Layer both sit on a light ground", () => {
    expect(BRAND.header).toBe("#F4F6FA");
    expect(BRAND.headerLine).toBe("#D5DCE8");
    expect(BRAND.headerInk).toBe("#0B1B3A");
    expect(BRAND.themeColor).toBe(BRAND.header);
    expect(BRAND.darkAccentTint).toBe("#102830");

    const logo = readPng("public/brand/image-0961fde4.png");
    const { x, y, width, height } = LOGO_CROP;
    let black = 0;
    let blue = 0;
    let outside = 0;
    for (let py = 0; py < logo.height; py += 1) {
      for (let px = 0; px < logo.width; px += 1) {
        const i = (py * logo.width + px) * 4;
        const r = logo.pixels[i];
        const g = logo.pixels[i + 1];
        const b = logo.pixels[i + 2];
        const a = logo.pixels[i + 3];
        if (a < 16) continue;
        const inside = px >= x && px < x + width && py >= y && py < y + height;
        if (!inside) {
          outside += 1;
          continue;
        }
        if (r + g + b < 80) black += 1;
        else if (b > r) blue += 1;
      }
    }
    expect(black).toBeGreaterThan(7000);
    expect(blue).toBeGreaterThan(15000);
    expect(outside).toBe(0);

    const mark = readFileSync("src/app/bench/brand-mark.tsx", "utf8");
    expect(mark).toContain("LOGO_CROP");
    expect(mark).toContain("/brand/image-0961fde4.png");
    expect(mark).toContain('alt="LaunchLayer"');
    expect(mark).not.toContain("logo-dark");
    expect(mark).not.toContain("invert");
  });

  it("keeps the node mark on a white icon, where the blue has AA contrast", () => {
    for (const path of [
      "public/icons/icon-192.png",
      "public/icons/icon-512.png",
      "public/icons/icon-maskable-512.png",
      "public/icons/apple-touch-icon.png",
    ]) {
      const icon = readPng(path);
      const corner = icon.pixels.subarray(0, icon.channels);
      expect([corner[0], corner[1], corner[2]]).toEqual([255, 255, 255]);
      const cx = Math.floor(icon.width / 2);
      const cy = Math.floor(icon.height / 2);
      const i = (cy * icon.width + cx) * icon.channels;
      const r = icon.pixels[i];
      const g = icon.pixels[i + 1];
      const b = icon.pixels[i + 2];
      expect(b).toBeGreaterThan(r + 40);
      const hex = `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
      expect(contrast(hex, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
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