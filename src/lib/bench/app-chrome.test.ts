import { readFileSync } from "fs";
import { createElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BenchShell } from "@/app/bench/shell";
import ErrorScreen from "@/app/error";
import Loading from "@/app/loading";
import LoginPage from "@/app/login/page";
import NotFound from "@/app/not-found";
import JobNotFound from "@/app/jobs/[ref]/not-found";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  redirect: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
    createElement("a", { href, ...props }, children),
}));

function html(node: ReactElement): string {
  return renderToStaticMarkup(node);
}

function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

function header(markup: string): string {
  const start = markup.indexOf("<header");
  const end = markup.indexOf("</header>");
  return markup.slice(start, end);
}

const SCREENS = [
  "src/app/page.tsx",
  "src/app/jobs/new/page.tsx",
  "src/app/jobs/[ref]/page.tsx",
  "src/app/ask/page.tsx",
  "src/app/jobs/[ref]/ask/page.tsx",
  "src/app/login/page.tsx",
  "src/app/error.tsx",
  "src/app/not-found.tsx",
  "src/app/jobs/[ref]/not-found.tsx",
  "src/app/loading.tsx",
  "src/app/jobs/new/loading.tsx",
  "src/app/jobs/[ref]/loading.tsx",
  "src/app/ask/loading.tsx",
  "src/app/jobs/[ref]/ask/loading.tsx",
];

describe("locked app chrome", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const frame = rule(css, ".app-frame");
  const scroll = rule(css, ".app-scroll");
  const topBar = rule(css, ".top-bar");
  const row = rule(css, ".top-bar-row");
  const tabBar = rule(css, ".tab-bar");
  const tabLink = rule(css, ".tab-link");
  const actionBar = rule(css, ".action-bar");

  it("keeps the document and frame from scrolling so only the middle region moves", () => {
    const root = rule(css, "html");
    const body = rule(css, "body");
    expect(root).toContain("overflow: hidden");
    expect(root).toContain("overscroll-behavior: none");
    expect(body).toContain("overflow: hidden");
    expect(body).toContain("overscroll-behavior: none");
    expect(body).toContain("position: fixed");
    expect(body).toContain("height: 100dvh");
    expect(body).toContain("max-height: 100dvh");

    expect(frame).toContain("display: flex");
    expect(frame).toContain("flex-direction: column");
    expect(frame).toContain("height: 100dvh");
    expect(frame).toContain("max-height: 100dvh");
    expect(frame).toContain("overflow: hidden");
    expect(frame).toContain("overscroll-behavior: none");
    expect(frame).not.toMatch(/position:\s*(?:sticky|fixed|absolute)/);

    expect(scroll).toContain("flex: 1");
    expect(scroll).toContain("min-height: 0");
    expect(scroll).toContain("overflow-x: hidden");
    expect(scroll).toContain("overflow-y: auto");
    expect(scroll).toContain("overscroll-behavior: contain");
    expect(scroll).toContain("-webkit-overflow-scrolling: touch");
    expect(scroll).toContain("touch-action: pan-y");
    expect(scroll).not.toContain("safe-area-inset-top");
    expect(scroll).not.toContain("safe-area-inset-bottom");
    expect(scroll).not.toContain("user-select");

    expect(topBar).toContain("flex: none");
    expect(tabBar).toContain("flex: none");
    expect(actionBar).toContain("flex: none");
    for (const block of [topBar, tabBar, actionBar, scroll]) {
      expect(block).not.toMatch(/position:\s*(?:sticky|fixed|absolute)/);
    }
    expect(css).not.toContain("position: sticky");
    expect(rule(css, ".app-scroll-fill")).toContain("overflow: hidden");
    expect(rule(css, ".chat-log")).toContain("overscroll-behavior: contain");
    expect(rule(css, ".chat-log")).toContain("-webkit-overflow-scrolling: touch");
    expect(rule(css, ".pin-form-body")).toContain("overscroll-behavior: contain");
    expect(rule(css, ".sheet")).toContain("overscroll-behavior: contain");
  });

  it("gives the safe-area insets to the bars and keeps one 56px row on every screen", () => {
    expect(topBar).toContain("padding-top: env(safe-area-inset-top)");
    expect(topBar).not.toContain("safe-area-inset-bottom");
    expect(row).toContain("display: flex");
    expect(row).toContain("align-items: center");
    expect(row).toContain("height: 56px");
    expect(row).toContain("min-height: 56px");

    const title = rule(css, ".top-bar-title");
    expect(title).toContain("flex: 1");
    expect(title).not.toMatch(/position:\s*absolute/);
    expect(title).not.toMatch(/text-align:\s*center/);

    expect(tabBar).toContain("padding-bottom: env(safe-area-inset-bottom)");
    expect(tabBar).toContain("min-height: calc(56px + env(safe-area-inset-bottom))");
    expect(tabBar).toContain("grid-template-rows: 56px");
    expect(tabBar).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(tabBar).not.toContain("safe-area-inset-top");

    expect(tabLink).toContain("align-items: center");
    expect(tabLink).toContain("justify-content: center");
    expect(tabLink).toContain("text-align: center");
    expect(tabLink).toContain("height: 100%");
    expect(tabLink).toContain("min-height: 56px");
    expect(tabLink).toContain("padding: 0 4px");
    expect(tabLink).not.toContain("padding: 8px 4px 6px");

    expect(css).toMatch(/\.top-bar-sign-out,[\s\S]*?min-height:\s*48px/);
    expect(css).toMatch(/\.top-bar-sign-out,[\s\S]*?min-width:\s*48px/);
    expect(css).toMatch(/\.tab-link,[\s\S]*?min-height:\s*48px/);
    expect(css).toMatch(/\.tab-link,[\s\S]*?min-width:\s*48px/);
    expect(css).toMatch(/\.icon-btn,[\s\S]*?min-height:\s*48px/);

    const chrome =
      css.match(/\.top-bar,\s*\.tab-bar,\s*\.tab-link,\s*\.top-bar a,\s*\.top-bar button\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(chrome).toContain("user-select: none");
    expect(chrome).toContain("-webkit-user-select: none");
    expect(chrome).toContain("-webkit-tap-highlight-color: transparent");
    expect(chrome).toContain("-webkit-touch-callout: none");
    expect(chrome).not.toContain("pointer-events: none");
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--link\)/);

    for (const path of SCREENS) {
      const text = readFileSync(path, "utf8");
      const sharesBar =
        text.includes("BenchShell") ||
        text.includes("PlainTopBar") ||
        text.includes("LoadingTopBar") ||
        text.includes('className="top-bar"');
      expect(sharesBar, path).toBe(true);
      if (text.includes('className="top-bar"')) {
        expect(text, path).toContain("top-bar-row");
      }
    }
  });

  it("puts the bars and the scroll region in one column, and releases that lock for the keyboard and short viewports", async () => {
    const jobs = html(
      BenchShell({
        title: "Jobs",
        titlePlacement: "bar",
        barTitleSize: "md",
        showSignOut: true,
        children: createElement("p", null, "list"),
      }),
    );
    const detail = html(
      BenchShell({
        title: "LL-4K7M",
        titlePlacement: "bar",
        backHref: "/",
        barMeta: "2 of 5",
        actionBar: createElement("div", null, "Add a note"),
        children: createElement("p", null, "notes"),
      }),
    );
    const created = html(
      BenchShell({
        title: "New job",
        titlePlacement: "bar",
        barTitleSize: "md",
        fill: true,
        children: createElement("p", null, "form"),
      }),
    );
    const ask = html(
      BenchShell({
        title: "Ask the record",
        titlePlacement: "bar",
        barTitleSize: "md",
        fill: true,
        barAction: createElement("button", { type: "button" }, "Clear"),
        children: createElement("p", null, "chat"),
      }),
    );
    const jobAsk = html(
      BenchShell({
        title: "Ask · LL-4K7M",
        titlePlacement: "bar",
        barTitleSize: "md",
        backHref: "/jobs/LL-4K7M",
        barSubtitle: "Ada · MacBook",
        fill: true,
        children: createElement("p", null, "chat"),
      }),
    );
    const login = html(await LoginPage({ searchParams: Promise.resolve({}) }));
    const error = html(createElement(ErrorScreen, { error: new Error("failed"), reset: () => {} }));
    const missing = html(createElement(NotFound));
    const jobMissing = html(createElement(JobNotFound));
    const loading = html(createElement(Loading));

    for (const markup of [jobs, detail, created, ask, jobAsk, login, error, missing, jobMissing, loading]) {
      expect(markup).toContain('class="app-frame"');
      expect(markup).toContain('class="top-bar"');
      expect(markup).toContain("top-bar-row");
      const bar = markup.indexOf('class="top-bar"');
      const region = markup.indexOf('class="app-scroll');
      expect(bar).toBeGreaterThan(-1);
      expect(region).toBeGreaterThan(bar);
      expect(header(markup)).not.toContain("top-bar-sub");
    }

    for (const markup of [jobs, detail, created, ask, jobAsk, error, missing, jobMissing, loading]) {
      const region = markup.indexOf('class="app-scroll');
      const tabs = markup.indexOf('class="tab-bar"');
      expect(tabs).toBeGreaterThan(region);
    }
    expect(login).not.toContain('class="tab-bar"');

    const detailAction = detail.indexOf('class="action-bar"');
    expect(detailAction).toBeGreaterThan(detail.indexOf('class="app-scroll'));
    expect(detailAction).toBeLessThan(detail.indexOf('class="tab-bar"'));
    expect(header(detail)).toContain('aria-label="Back to jobs"');
    expect(header(jobs)).toContain("Sign out");
    expect(header(ask)).toContain("Clear");

    expect(jobAsk.indexOf("Ada · MacBook")).toBeGreaterThan(jobAsk.indexOf("</header>"));
    expect(jobAsk.indexOf("Ada · MacBook")).toBeLessThan(jobAsk.indexOf("</main>"));

    const providers = readFileSync("src/app/bench/providers.tsx", "utf8");
    expect(providers).toContain("visualViewport");
    expect(providers).toContain("--kb");
    expect(providers).toContain("dataset.kb");
    expect(providers).toContain("inset > 80");
    expect(css).toContain("bottom: var(--kb, 0px)");
    expect(css).toContain("var(--kb, 0px)");

    const short = css.slice(css.indexOf("@media (max-height: 480px)"));
    expect(short).toMatch(/html,\s*body\s*\{[^}]*position:\s*static/);
    expect(short).toMatch(/html,\s*body\s*\{[^}]*overflow:\s*auto/);
    expect(short).toMatch(/\.app-frame\s*\{[^}]*height:\s*auto/);
    expect(short).toMatch(/\.app-frame\s*\{[^}]*overflow:\s*visible/);
    expect(short).toMatch(/\.app-scroll\s*\{[^}]*overflow:\s*visible/);
    expect(short).toMatch(/\.tab-bar,\s*\.action-bar\s*\{[^}]*position:\s*static/);

    expect(css).toMatch(/html\[data-kb="1"\],\s*html\[data-kb="1"\] body\s*\{[^}]*position:\s*static/);
    expect(css).toMatch(/html\[data-kb="1"\],\s*html\[data-kb="1"\] body\s*\{[^}]*overflow:\s*auto/);
    expect(css).toMatch(/html\[data-kb="1"\] \.app-frame\s*\{[^}]*height:\s*auto/);
    expect(css).toMatch(/html\[data-kb="1"\] \.app-frame\s*\{[^}]*min-height:\s*0/);
    expect(css).toMatch(/html\[data-kb="1"\] \.app-frame\s*\{[^}]*overflow:\s*visible/);
    expect(css).toMatch(/html\[data-kb="1"\] \.app-scroll\s*\{[^}]*overflow:\s*visible/);
    expect(css).toMatch(/html\[data-kb="1"\] \.tab-bar,\s*html\[data-kb="1"\] \.action-bar\s*\{[^}]*position:\s*static/);
  });
});
