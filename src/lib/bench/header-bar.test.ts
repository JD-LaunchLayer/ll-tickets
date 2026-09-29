import { createHash } from "crypto";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BRAND, contrast } from "@/lib/brand";
import { BenchShell } from "@/app/bench/shell";
import ErrorScreen from "@/app/error";
import Loading from "@/app/loading";
import LoginPage from "@/app/login/page";
import { viewport } from "@/app/layout";
import manifest from "@/app/manifest";
import NotFound from "@/app/not-found";
import JobNotFound from "@/app/jobs/[ref]/not-found";

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "--font-inter" }),
  Space_Grotesk: () => ({ variable: "--font-space" }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  redirect: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

const ICON_SHA256: Record<string, string> = {
  "public/icons/icon-192.png": "6085550513845bd1a8e26d38119b7c21b39f2990059b12e519097db09aeedfe4",
  "public/icons/icon-512.png": "b9411070c702c830022c28315e5c7ca2f6a7898a9ca3c681f6ec5b84992508e9",
  "public/icons/icon-maskable-512.png": "979c32b32693d2470cded3e1ae2296df0c7019afb7273ba83e541497647ec808",
  "public/icons/apple-touch-icon.png": "313960a7a736afaf3aa453bb5d79a5e92de35992a60ee7203a74cc464cde312f",
  "src/app/favicon.ico": "2b8ad2d33455a8f736fc3a8ebf8f0bdea8848ad4c0db48a2833bd0f9cd775932",
};

const BRAND_FILE = "public/brand/image-0961fde4.png";
const BRAND_SHA256 = "dad197f6976db146a2bcd7857d0427be4002ef067a5595a232f551348ff9f2b5";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

function html(node: ReactElement): string {
  return renderToStaticMarkup(node);
}

function firstLandmark(markup: string): string {
  const match = markup.match(/<(header|nav|main|footer|aside|form)\b[^>]*>/);
  return match?.[0] ?? "";
}

function headings(markup: string): string[] {
  return [...markup.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((match) => match[1]);
}

function assertNoBand(markup: string) {
  expect(markup).not.toContain("/brand/");
  expect(markup).not.toMatch(/class="[^"]*\b(?:brand-logo|app-header|brand-home|header-action)\b/);
  expect(firstLandmark(markup)).toBe('<header class="top-bar">');
}

describe("compact top bar (checks 34 to 40)", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const sources = walk("src").filter((path) => /\.(tsx|ts|css)$/.test(path) && !path.endsWith(".test.ts"));

  it("renders no logo and no band on sign-in, Jobs, error, not-found and loading", async () => {
    const login = html(await LoginPage({ searchParams: Promise.resolve({}) }));
    const jobs = html(
      BenchShell({
        title: "Jobs",
        titlePlacement: "bar",
        barTitleSize: "md",
        showSignOut: true,
        children: createElement("p", null, "list"),
      }),
    );
    const error = html(createElement(ErrorScreen, { error: new Error("failed"), reset: () => {} }));
    const missing = html(createElement(NotFound));
    const jobMissing = html(createElement(JobNotFound));
    const loading = html(createElement(Loading));

    for (const markup of [login, jobs, error, missing, jobMissing, loading]) {
      assertNoBand(markup);
    }

    expect(headings(login)).toEqual(["Sign in"]);
    expect(login).not.toContain("Sign out");
    expect(login.indexOf("<h1")).toBeGreaterThan(login.indexOf('<header class="top-bar">'));
    expect(login.indexOf("</h1>")).toBeLessThan(login.indexOf("</header>"));

    expect(headings(jobs)).toEqual(["Jobs"]);
    expect(jobs).toContain('<button class="top-bar-sign-out" type="submit">Sign out</button>');
    expect(jobs.indexOf("</h1>")).toBeLessThan(jobs.indexOf("</header>"));

    expect(headings(error)).toEqual(["Something went wrong"]);
    expect(headings(missing)).toEqual(["Not found"]);
    expect(headings(jobMissing)).toEqual(["Not on the bench"]);
    for (const markup of [error, missing, jobMissing]) {
      expect(markup).toContain('<button class="top-bar-sign-out" type="submit">Sign out</button>');
      expect(markup).toContain('aria-label="Bench"');
    }

    expect(headings(loading)).toEqual([]);
    expect(loading).toContain("skeleton-bar-title");
    expect(loading).toContain(">Loading</p>");
    expect(loading).not.toContain("Sign out");

    const jobsSource = readFileSync("src/app/page.tsx", "utf8");
    expect(jobsSource).toContain('title="Jobs"');
    expect(jobsSource).toContain('titlePlacement="bar"');
    expect(jobsSource).toContain('barTitleSize="md"');
    expect(jobsSource).toContain("showSignOut");
    expect(jobsSource).not.toContain('titlePlacement="sr"');

    for (const path of sources) {
      const text = readFileSync(path, "utf8");
      expect(text, path).not.toContain("/brand/");
      expect(text, path).not.toContain("brand-logo");
      expect(text, path).not.toContain("brand-home");
      expect(text, path).not.toContain("BrandMark");
      expect(text, path).not.toContain("LOGO_CROP");
      expect(text, path).not.toContain("app-header");
      expect(text, path).not.toContain("header-action");
      expect(text, path).not.toContain('chrome="band"');
      expect(text, path).not.toContain("compact-viewport");
    }
  });

  it("paints the top bar with the same canvas as the frame", () => {
    const bar = css.match(/\.top-bar\s*\{[^}]*\}/)?.[0] ?? "";
    const frame = css.match(/\.app-frame\s*\{[^}]*\}/)?.[0] ?? "";
    expect(bar).toContain("background: var(--canvas)");
    expect(frame).toContain("background: var(--canvas)");
    expect(bar).toContain("border-bottom: 1px solid var(--line)");
    expect(css).toContain("--canvas: #eaf2f3");
    const dark = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"), css.indexOf("@theme"));
    expect(dark).toContain("--canvas: #0b2029");
    expect(BRAND.canvas).toBe("#EAF2F3");
    expect(BRAND.darkCanvas).toBe("#0B2029");
  });

  it("exports exactly two theme-color tags from the root viewport", () => {
    const themeColor = viewport.themeColor;
    expect(Array.isArray(themeColor)).toBe(true);
    if (!Array.isArray(themeColor)) return;
    const tags = themeColor.map(
      (entry) => `<meta name="theme-color" media="${entry.media}" content="${entry.color}" />`,
    );
    expect(tags).toEqual([
      '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#EAF2F3" />',
      '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0B2029" />',
    ]);
    expect(tags).toHaveLength(2);

    const exporters = sources.filter((path) => /export const viewport\b/.test(readFileSync(path, "utf8")));
    expect(exporters).toEqual(["src/app/layout.tsx"]);
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toContain('statusBarStyle: "default"');
    expect(layout).not.toContain("black-translucent");
  });

  it("sizes Sign out to 48px in link colour with AA contrast on the canvas", () => {
    expect(css).toMatch(/\.top-bar-sign-out,[\s\S]*?min-height:\s*48px/);
    expect(css).toMatch(/\.top-bar-sign-out,[\s\S]*?min-width:\s*48px/);
    const button = css.match(/\.top-bar-sign-out\s*\{[^}]*\}/)?.[0] ?? "";
    expect(button).toContain("padding: 0 12px");
    expect(button).toContain("border: 0");
    expect(button).toContain("border-radius: 12px");
    expect(button).toContain("color: var(--link)");
    expect(button).toContain("font-size: 1rem");
    expect(button).toContain("font-weight: 600");
    expect(button).toContain("line-height: 1.5rem");
    expect(css).toContain("--link: #0048b0");
    const dark = css.slice(css.indexOf("@media (prefers-color-scheme: dark)"), css.indexOf("@theme"));
    expect(dark).toContain("--link: #b7d2ff");
    expect(contrast(BRAND.accent, BRAND.canvas)).toBeCloseTo(7.24, 2);
    expect(contrast(BRAND.accentLight, BRAND.darkCanvas)).toBeCloseTo(10.92, 2);
    expect(contrast("#0048B0", "#EAF2F3")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#B7D2FF", "#0B2029")).toBeGreaterThanOrEqual(4.5);

    expect(css).toMatch(/\.top-bar\s*\{[^}]*padding-right:\s*max\(4px, env\(safe-area-inset-right\)\)/);
    expect(css).toMatch(/\.top-bar-row-plain\s*\{[^}]*padding-right:\s*var\(--s2\)/);
    expect(css).toMatch(/\.top-bar-row-plain\s*\{[^}]*padding-left:\s*var\(--s3\)/);
    expect(css).toContain("--s2: 8px");
    expect(css).toContain("--s3: 12px");
    expect(css).toMatch(/\.top-bar-sign-out-form\s*\{[^}]*margin:\s*0/);
    // Bar padding 4px plus the plain row's 8px puts the button's right edge 12px from the frame.
    expect(4 + 8).toBeLessThanOrEqual(16);
    expect(css).toMatch(/\.top-bar-title-md\s*\{[^}]*font-size:\s*1\.25rem/);
    expect(css).toMatch(/\.top-bar-title-md\s*\{[^}]*line-height:\s*1\.75rem/);
    expect(css).toMatch(/\.top-bar-title\s*\{[^}]*font-weight:\s*600/);
    expect(css).toMatch(/\.top-bar-row\s*\{[^}]*min-height:\s*56px/);
  });

  it("keeps the bar title below the safe-area inset", () => {
    expect(css).toMatch(/\.top-bar\s*\{[^}]*padding-top:\s*env\(safe-area-inset-top\)/);
    expect(css).not.toMatch(/\.top-bar-title\s*\{[^}]*position:\s*(?:absolute|fixed)/);
    expect(css).not.toMatch(/\.top-bar-title[^{]*\{[^}]*top:\s*-/);
    const loginLead = css.match(/\.login-lead\s*\{[^}]*\}/)?.[0] ?? "";
    expect(loginLead).toContain("margin: 0");
    expect(css).toMatch(/\.app-scroll-start\s*\{[^}]*padding-top:\s*24px/);
    expect(css).toMatch(/\.skeleton-bar-title\s*\{[^}]*width:\s*96px/);
    expect(css).toMatch(/\.skeleton-bar-title\s*\{[^}]*height:\s*20px/);
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--link\)/);
    expect(css).not.toContain(".app-header :focus-visible");
  });

  it("sets the manifest colours to the dark canvas and leaves the icon bytes alone", () => {
    const webManifest = manifest();
    expect(webManifest.theme_color).toBe("#0B2029");
    expect(webManifest.background_color).toBe("#0B2029");
    expect(webManifest.theme_color).toBe(BRAND.darkCanvas);
    expect(webManifest.background_color).toBe(BRAND.darkCanvas);

    for (const [path, expected] of Object.entries(ICON_SHA256)) {
      const digest = createHash("sha256").update(readFileSync(path)).digest("hex");
      expect(digest, path).toBe(expected);
    }
    expect(createHash("sha256").update(readFileSync(BRAND_FILE)).digest("hex")).toBe(BRAND_SHA256);
    expect(sources.some((path) => readFileSync(path, "utf8").includes("/brand/"))).toBe(false);
  });
});
