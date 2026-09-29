/**
 * @vitest-environment jsdom
 */
import { readFileSync } from "fs";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createElement, type ReactElement } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AskChat } from "@/app/ask/chat";
import { NoteList, type NoteRow } from "@/app/bench/note-list";
import { ReplyBlocks } from "@/app/bench/note-blocks";
import { SaveHeadline } from "@/app/bench/save-headline";
import { WhereAt } from "@/app/bench/where-at";
import { noteHeadline, noteOpenKey, readNoteOpenIds } from "@/lib/bench/note-view";
import { NOTE_TAG_LABELS, NOTE_TAGS, type NoteTag } from "@/lib/jobs/domain";

vi.mock("@/app/ask/actions", () => ({
  saveAssistantNoteAction: vi.fn(async () => ({ error: null, reason: null })),
}));

vi.mock("@/app/bench/actions", () => ({
  saveNextMoveAction: vi.fn(async () => ({ error: null, reason: null })),
  setStatusAction: vi.fn(async () => ({ error: null, reason: null })),
}));

const LONG = [
  "The machine posts but the image drops out after a few minutes, which points at the panel rail rather than the SSD.",
  "",
  "Next 2 checks:",
  "1. **Visual inspect mainboard:** look for corrosion around the power stages.",
  "2. **Check the power rail:** confirm the rail stays up when the backlight cuts.",
].join("\n");

const CREATED = "2026-09-29T20:30:00.000Z";

function row(partial: Partial<NoteRow> & Pick<NoteRow, "id" | "text" | "tag">): NoteRow {
  return {
    summary: "",
    amountGbp: null,
    partDetail: null,
    clientRequestId: "bench-note-0001",
    createdAt: CREATED,
    editedAt: null,
    ...partial,
  };
}

function mountCss(): void {
  const css = readFileSync("src/app/globals.css", "utf8");
  const start = css.indexOf("/* BEGIN PR 14b notes feed");
  const end = css.indexOf("/* END PR 14b notes feed */");
  const style = document.createElement("style");
  style.textContent = `:root{--edge:#5b7079;--accent-tint:#f1f6ff;--accent-deep:#003280;--accent-light:#b7d2ff;--link:#0048b0;--body:#364851;--ink:#0b2029;--muted:#49585f;--success-text:#137738;--sel-edge:#0048b0;--line:#d3e2e6;--font-space:"Space Grotesk";--font-inter:Inter}${css.slice(start, end)}`;
  document.head.appendChild(style);
}

async function render(node: ReactElement): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(node);
  });
  return { container, root };
}

async function unmount(mounted: { container: HTMLDivElement; root: Root }): Promise<void> {
  await act(async () => {
    mounted.root.unmount();
  });
  mounted.container.remove();
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mountCss();
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  sessionStorage.clear();
  document.body.innerHTML = "";
  mountCss();
});

describe("note rows", () => {
  it("gives every tag an icon, a label and a time, and bolds only a finding", async () => {
    const notes = NOTE_TAGS.map((tag, index) =>
      row({
        id: `tag-${tag}`,
        tag,
        text: tag === "parts" ? "Paste" : tag === "finding" ? "Short finding" : "Plain text",
        clientRequestId: tag === "finding" ? "asstabcdef12345678" : `bench-tag-${index}1`,
      }),
    );
    notes.push(row({ id: "tag-none", tag: null, text: "No tag" }));
    const mounted = await render(createElement(NoteList, { jobRef: "LL-HPS3", notes }));
    const labels = [...mounted.container.querySelectorAll(".note-type-label")].map((node) => node.textContent);
    expect(labels).toEqual([...NOTE_TAGS.map((tag) => NOTE_TAG_LABELS[tag]), "Untagged"]);
    for (const item of mounted.container.querySelectorAll(".note-row")) {
      expect(item.querySelector(".note-type-icon")?.getAttribute("aria-hidden")).toBe("true");
      expect(item.querySelector("time")?.getAttribute("dateTime")).toBe(CREATED);
    }
    const finding = mounted.container.querySelector("#note-tag-finding .note-text");
    const parts = mounted.container.querySelector("#note-tag-parts .note-text");
    expect(finding).toBeTruthy();
    expect(window.getComputedStyle(finding as Element).fontWeight).toBe("600");
    expect(window.getComputedStyle(parts as Element).fontWeight).toBe("400");
    expect(mounted.container.querySelector("#note-tag-finding")?.textContent).toContain("Finding");
    expect(mounted.container.querySelector("#note-tag-finding")?.textContent).toContain("from Ask");
    expect(mounted.container.querySelector("#note-tag-quote_auth .note-type-icon-quote")).toBeTruthy();
    expect(mounted.container.querySelector("#note-tag-quote_auth .money-chip")).toBeNull();
    await unmount(mounted);
  });

  it("shows a parts chip and leaves the stored text alone", async () => {
    const stored = "New logic board - £239";
    const note = row({ id: "part-1", tag: "parts", text: stored, partDetail: "New logic board" });
    const mounted = await render(createElement(NoteList, { jobRef: "LL-HPS3", notes: [note] }));
    expect(mounted.container.querySelector(".note-text")?.textContent).toBe("New logic board");
    const chip = mounted.container.querySelector(".money-chip");
    expect(chip?.textContent).toBe("£239");
    expect(note.text).toBe(stored);
    const style = window.getComputedStyle(chip as Element);
    expect(style.height).toBe("28px");
    expect(style.borderRadius).toBe("8px");
    expect(style.fontVariantNumeric).toContain("tabular-nums");
    const moneyRow = mounted.container.querySelector(".note-money");
    expect(window.getComputedStyle(moneyRow as Element).gap).toBe("12px");
    const quote = row({ id: "quote-1", tag: "quote_auth", text: "Agreed £180" });
    const quoted = await render(createElement(NoteList, { jobRef: "LL-HPS3", notes: [quote] }));
    expect(quoted.container.querySelector(".money-chip")?.textContent).toBe("£180");
    expect(quoted.container.querySelector(".note-type-icon-quote")).toBeTruthy();
    await unmount(mounted);
    await unmount(quoted);
  });

  it("collapses a long note and expands it without scrolling", async () => {
    const note = row({
      id: "long-1",
      tag: "finding",
      text: LONG,
      summary: LONG.split("\n")[0].slice(0, 120),
      clientRequestId: "asstlongnote000001",
    });
    const mounted = await render(createElement(NoteList, { jobRef: "LL-HPS3", notes: [note] }));
    const button = mounted.container.querySelector<HTMLButtonElement>(".note-expander");
    expect(button).toBeTruthy();
    expect(button?.getAttribute("aria-expanded")).toBe("false");
    expect(button?.textContent).toContain("Show full note");
    expect(button?.textContent).toContain(noteHeadline(note).replace(/…$/, "").slice(0, 24));
    const detail = document.getElementById(button?.getAttribute("aria-controls") ?? "");
    expect(detail).toBeTruthy();
    expect((detail as HTMLElement).hasAttribute("inert") || (detail as HTMLElement).inert).toBe(true);
    expect(window.getComputedStyle(button as Element).minHeight).toBe("48px");
    const headline = button?.querySelector(".note-headline");
    expect(window.getComputedStyle(headline as Element).webkitLineClamp).toBe("3");
    const before = window.scrollY;
    await act(async () => {
      button?.click();
    });
    expect(window.scrollY).toBe(before);
    expect(button?.getAttribute("aria-expanded")).toBe("true");
    expect(button?.textContent).toContain("Hide full note");
    expect(window.getComputedStyle(button as Element).minHeight).toBe("48px");
    expect(detail?.querySelector("ol")?.getAttribute("role")).toBe("list");
    expect(detail?.querySelectorAll("ol li")).toHaveLength(2);
    expect(detail?.querySelector(".note-step-mark")?.textContent).toBe("1");
    expect(detail?.querySelector(".note-step-text b")?.textContent).toContain("Visual inspect mainboard");
    expect(window.getComputedStyle(detail?.querySelector("b") as Element).fontWeight).toBe("600");
    expect(detail?.textContent).toContain("Next 2 checks");
    expect(window.getComputedStyle(detail?.querySelector(".note-steps") as Element).borderLeftWidth).toBe("2px");
    const visible = [...(detail?.querySelectorAll("h3, p, .note-step-text") ?? [])]
      .map((node) => node.textContent ?? "")
      .join(" ");
    expect(visible.replace(/\s+/g, " ")).toContain("Visual inspect mainboard");
    expect(visible).not.toContain("**");
    expect(detail?.querySelector("script, img, a")).toBeNull();
    await unmount(mounted);
  });

  it("keeps the expanded note for the job and starts a new session collapsed", async () => {
    const note = row({ id: "long-2", tag: "finding", text: LONG });
    const first = await render(createElement(NoteList, { jobRef: "LL-AAAA", notes: [note] }));
    await act(async () => {
      first.container.querySelector<HTMLButtonElement>(".note-expander")?.click();
    });
    expect(readNoteOpenIds(sessionStorage, "LL-AAAA")).toEqual(["long-2"]);
    await unmount(first);
    const second = await render(createElement(NoteList, { jobRef: "LL-AAAA", notes: [note] }));
    expect(second.container.querySelector(".note-expander")?.getAttribute("aria-expanded")).toBe("true");
    await unmount(second);
    sessionStorage.removeItem(noteOpenKey("LL-AAAA"));
    const third = await render(createElement(NoteList, { jobRef: "LL-AAAA", notes: [note] }));
    expect(third.container.querySelector(".note-expander")?.getAttribute("aria-expanded")).toBe("false");
    await unmount(third);
  });

  it("hides nothing unless an expander is closed, and renders hostile text as text", async () => {
    const hostile = "<script>alert(1)</script> <img src=x onerror=alert(1)> [link](javascript:alert(1)) **";
    const notes: NoteRow[] = [
      row({ id: "short", tag: "work_done", text: "Replaced the paste." }),
      row({ id: "word", tag: "other", text: "Done" }),
      row({ id: "long", tag: "finding", text: LONG }),
      row({ id: "list", tag: "finding", text: "1. Check the jack" }),
      row({ id: "head", tag: "other", text: "Next 2 checks:" }),
      row({ id: "wall", tag: "finding", text: `${"word ".repeat(800)}`.slice(0, 4000) }),
      row({ id: "solid", tag: "finding", text: "x".repeat(4000) }),
      row({ id: "hostile", tag: "other", text: hostile }),
    ];
    const alerts: string[] = [];
    const original = window.alert;
    window.alert = (message?: unknown) => {
      alerts.push(String(message));
    };
    const mounted = await render(createElement(NoteList, { jobRef: "LL-HPS3", notes }));
    for (const note of notes) {
      const item = mounted.container.querySelector(`#note-${note.id}`);
      expect(item, note.id).toBeTruthy();
      const clone = item?.cloneNode(true) as HTMLElement;
      clone.querySelectorAll(".note-detail, .note-expander-caption").forEach((node) => node.remove());
      const shown = (clone.textContent ?? "").replace(/\s+/g, " ").trim();
      const whole = note.text.replace(/\s+/g, " ").trim();
      const hidden = !shown.includes(whole);
      const expander = item?.querySelector(".note-expander");
      if (hidden) expect(expander?.getAttribute("aria-expanded"), note.id).toBe("false");
      else expect(expander, note.id).toBeNull();
    }
    expect(mounted.container.querySelector("#note-hostile script, #note-hostile img, #note-hostile a")).toBeNull();
    expect(mounted.container.querySelector("#note-hostile")?.textContent).toContain("<script>alert(1)</script>");
    expect(mounted.container.querySelector("#note-hostile")?.textContent).toContain("**");
    expect(alerts).toEqual([]);
    window.alert = original;
    const sources = [
      "src/app/bench/note-list.tsx",
      "src/app/bench/note-blocks.tsx",
      "src/lib/bench/note-view.ts",
      "src/app/ask/chat.tsx",
    ];
    for (const file of sources) expect(readFileSync(file, "utf8")).not.toContain("dangerouslySetInnerHTML");
    await unmount(mounted);
  });

  it("jumps from the latest finding to the open note", async () => {
    const note = row({ id: "jump-1", tag: "finding" as NoteTag, text: LONG, summary: "" });
    const headline = noteHeadline(note);
    const mounted = await render(
      createElement(
        "div",
        null,
        createElement(WhereAt, {
          jobRef: "LL-HPS3",
          status: "diagnosing",
          nextMove: "Order the board",
          latestKind: "finding",
          latestText: headline,
          latestTime: "29 Sep 2026 at 21:30",
          latestNoteId: note.id,
        }),
        createElement(NoteList, { jobRef: "LL-HPS3", notes: [note] }),
      ),
    );
    const card = mounted.container.querySelector<HTMLButtonElement>(".now-finding");
    expect(card?.textContent).toContain(headline.slice(0, 20));
    expect(card?.tagName).toBe("BUTTON");
    await act(async () => {
      card?.click();
    });
    const hide = mounted.container.querySelector<HTMLButtonElement>("[data-note-hide]");
    expect(hide?.getAttribute("aria-expanded")).toBe("true");
    expect(hide?.textContent).toContain("Hide full note");
    expect(document.activeElement).toBe(hide);
    await unmount(mounted);
  });

  it("previews the save-to-notes headline and renders Ask replies without asterisks", async () => {
    const preview = await render(createElement(SaveHeadline, { text: LONG }));
    expect(preview.container.textContent).toContain("Headline:");
    expect(preview.container.textContent).not.toContain("**");
    await unmount(preview);
    const changed = await render(createElement(SaveHeadline, { text: "Fan seized. The bearing is dry." }));
    expect(changed.container.textContent).toContain("Headline: Fan seized. The bearing is dry.");
    await unmount(changed);

    const reply = await render(createElement(ReplyBlocks, { text: LONG }));
    expect(reply.container.querySelector("h3")?.textContent).toContain("Next 2 checks");
    expect(reply.container.querySelector("b")?.textContent).toContain("Visual inspect mainboard");
    expect(reply.container.textContent).not.toContain("**");
    await unmount(reply);

    sessionStorage.setItem("ll-ask:LL-HPS3", JSON.stringify([{ role: "assistant", text: LONG }]));
    const chat = await render(createElement(AskChat, { configured: true, scopeRef: "LL-HPS3" }));
    const save = [...chat.container.querySelectorAll("button")].find((button) => button.textContent === "Save to notes");
    await act(async () => {
      save?.click();
    });
    expect(chat.container.textContent).toContain("Headline:");
    const area = chat.container.querySelector<HTMLTextAreaElement>(".save-text-input");
    expect(area).toBeTruthy();
    await act(async () => {
      const prototype = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
      prototype?.set?.call(area, "Fan seized. The bearing is dry.");
      area?.dispatchEvent(new Event("input", { bubbles: true }));
      area?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(chat.container.textContent).toContain("Headline: Fan seized. The bearing is dry.");
    await unmount(chat);
  });

  it("declares a 160ms expand and a reduced-motion stop", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const block = css.slice(css.indexOf("/* BEGIN PR 14b notes feed"), css.indexOf("/* END PR 14b notes feed */"));
    expect(block).toContain("transition: grid-template-rows 160ms ease-out");
    expect(block).toContain("min-height: 48px");
    expect(block).toContain("height: 28px");
    expect(block).toContain("prefers-reduced-motion: reduce");
    expect(block).toContain("transition-duration: 0s");
    expect(block).toContain("transform: none");
    expect(block).not.toMatch(/\.app-frame|\.top-bar|\.tab-bar|\.app-header/);
    const wrap = document.createElement("div");
    wrap.className = "note-detail-wrap";
    document.body.appendChild(wrap);
    const duration = window.getComputedStyle(wrap).transitionDuration;
    if (duration === "0s") {
      expect(block).toMatch(/\.note-detail-wrap\s*\{[^}]*transition:\s*grid-template-rows\s+160ms/);
    } else {
      expect(["0.16s", "160ms"]).toContain(duration);
    }
  });
});
