import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { createBenchJob } from "@/lib/bench/jobs";
import { addBenchNote, summaryFromNoteText } from "@/lib/bench/notes";
import {
  blocksPlainText,
  comparableNoteText,
  derivedHeadline,
  formatPence,
  isLongNote,
  moneyDisplayText,
  noteAmount,
  noteChipPence,
  noteHeadline,
  noteOpenKey,
  NOTE_OPEN_LIMIT,
  parseNoteBody,
  partsSummary,
  readNoteOpenIds,
  writeNoteOpenIds,
  type NoteBlock,
  type NoteMoneyInput,
} from "@/lib/bench/note-view";
import { BRAND, contrast } from "@/lib/brand";
import { toPublicNote, type Note } from "@/lib/jobs/domain";
import { MemoryJobRepository } from "@/lib/jobs/memory-repository";
import { parseAddNote } from "@/lib/jobs/validate";

const money = (partial: Partial<NoteMoneyInput> & Pick<NoteMoneyInput, "text" | "tag">): NoteMoneyInput => ({
  amountGbp: null,
  ...partial,
});

class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

function flatten(blocks: readonly NoteBlock[]): string {
  return comparableNoteText(blocksPlainText(blocks));
}

describe("noteAmount", () => {
  it("lets amount_gbp win, parses one £ on the first line, and refuses a guess", () => {
    expect(noteAmount(money({ tag: "parts", text: "New logic board - £239", amountGbp: 10 }))).toBe(1000);
    expect(noteAmount(money({ tag: "parts", text: "New logic board - £239" }))).toBe(23900);
    expect(noteAmount(money({ tag: "parts", text: "Cable £239.50" }))).toBe(23950);
    expect(noteAmount(money({ tag: "quote_auth", text: "Agreed £1,239" }))).toBe(123900);
    expect(noteAmount(money({ tag: "parts", text: "Board £ 239" }))).toBe(23900);
    expect(noteAmount(money({ tag: "parts", text: "Was £250, now £239" }))).toBeNull();
    expect(noteAmount(money({ tag: "parts", text: "New logic board" }))).toBeNull();
    expect(noteAmount(money({ tag: "finding", text: "The board is £239" }))).toBeNull();
    expect(noteAmount(money({ tag: "parts", text: "Call 07595 620144" }))).toBeNull();
    expect(noteAmount(money({ tag: "parts", text: "New logic board\nQuoted £15 later" }))).toBeNull();
    expect(noteChipPence(money({ tag: "finding", text: "x", amountGbp: 239 }))).toBeNull();
  });

  it("documents the 'was £250, now £239' misread", () => {
    const text = "was £250, now £239";
    const firstOnly = text.match(/£\s?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?/);
    expect(firstOnly?.[0].replace(/\D/g, "")).toBe("250");
    expect(noteAmount(money({ tag: "parts", text }))).toBeNull();
    expect(noteAmount(money({ tag: "parts", text: "was £250, now 239" }))).toBe(25000);
  });
});

describe("partsSummary", () => {
  it("sums parts in pence and leaves quotes and blanks out", () => {
    const summary = partsSummary([
      money({ tag: "parts", text: "Board £239" }),
      money({ tag: "parts", text: "Paste £15" }),
      money({ tag: "parts", text: "Tape", amountGbp: 4.99 }),
      money({ tag: "quote_auth", text: "Quote £180" }),
      money({ tag: "parts", text: "No price written" }),
    ]);
    expect(summary).toEqual({ pence: 25899, count: 3 });
    expect(formatPence(summary.pence)).toBe("£258.99");
    const coins = partsSummary([
      money({ tag: "parts", text: "a", amountGbp: 0.1 }),
      money({ tag: "parts", text: "b", amountGbp: 0.2 }),
    ]);
    expect(coins).toEqual({ pence: 30, count: 2 });
    expect(formatPence(30)).toBe("£0.30");
    expect(formatPence(123900)).toBe("£1,239");
    expect(formatPence(23950)).toBe("£239.50");
  });

  it("counts a part twice when it was filed twice", () => {
    const summary = partsSummary([
      money({ tag: "parts", text: "New logic board - £239" }),
      money({ tag: "parts", text: "New logic board - £239" }),
    ]);
    expect(summary).toEqual({ pence: 47800, count: 2 });
  });
});

describe("money display text", () => {
  it("strips a parts label and one edge amount equal to the chip", () => {
    const stored = "New logic board - £239";
    const note = money({ tag: "parts", text: stored });
    expect(moneyDisplayText(note)).toBe("New logic board");
    expect(note.text).toBe(stored);
    expect(moneyDisplayText(money({ tag: "parts", text: "Part: New logic board - £239" }))).toBe("New logic board");
    expect(moneyDisplayText(money({ tag: "parts", text: "Parts needed: SSD - £45" }))).toBe("SSD");
    expect(moneyDisplayText(money({ tag: "parts", text: "£239 - New logic board" }))).toBe("New logic board");
    expect(moneyDisplayText(money({ tag: "parts", text: "£239 for New logic board" }))).toBe("New logic board");
    expect(moneyDisplayText(money({ tag: "parts", text: "Board was £239 yesterday" }))).toBe("Board was £239 yesterday");
    expect(moneyDisplayText(money({ tag: "quote_auth", text: "Quote £180 agreed" }))).toBe("Quote £180 agreed");
  });
});

describe("noteHeadline", () => {
  it("uses an authored summary and replaces a 120-character mid-sentence cut", () => {
    const line =
      "The charging circuit is open from the jack through to the mainboard and the battery is not being detected by the controller today at all.";
    expect(line.length).toBeGreaterThan(120);
    const cutoff = line.slice(0, 120);
    expect(cutoff.length).toBe(120);
    expect(line.startsWith(cutoff)).toBe(true);
    expect(line).not.toBe(cutoff);
    const derived = noteHeadline({ text: line, summary: cutoff });
    expect(derived).not.toBe(cutoff);
    expect(derived.endsWith("…")).toBe(true);
    expect(derived.length).toBeLessThanOrEqual(90);
    expect(noteHeadline({ text: line, summary: "Board is dead" })).toBe("Board is dead");
    expect(noteHeadline({ text: "Fan seized and the rest of the line.", summary: "Fan seized" })).toBe("Fan seized");
  });

  it("does not end a sentence on an abbreviation or a decimal", () => {
    expect(derivedHeadline("See e.g. the burnt connector before ordering.")).toBe(
      "See e.g. the burnt connector before ordering.",
    );
    expect(derivedHeadline("The rail reads £2.39 and then collapses.")).toBe("The rail reads £2.39 and then collapses.");
    expect(derivedHeadline("She tuned the piano. The rest stays out of this headline.")).toBe("She tuned the piano.");
  });

  it("caps a long sentence at 90 characters and joins a heading with the first step", () => {
    const sentence = `${"word ".repeat(70)}end.`;
    expect(sentence.length).toBeGreaterThan(300);
    const capped = derivedHeadline(sentence);
    expect(capped.endsWith("…")).toBe(true);
    expect(capped.length).toBeLessThanOrEqual(90);
    expect(derivedHeadline("a".repeat(150))).toBe(`${"a".repeat(89)}…`);
    const headed = "Next 2 checks:\n1. **Inspect the mainboard** for liquid damage around the power stages.";
    const headline = derivedHeadline(headed);
    expect(headline.startsWith("Next 2 checks: Inspect the mainboard")).toBe(true);
    expect(headline).not.toContain("*");
    expect(derivedHeadline("**Liquid damage** around the jack.")).toBe("Liquid damage around the jack.");
  });

  it("appends a second sentence when the first is under 20 characters", () => {
    expect(derivedHeadline("Fan seized. The bearing is dry.")).toBe("Fan seized. The bearing is dry.");
  });
});

describe("summaryFromNoteText", () => {
  it("stores one line of at most 120 characters that parseAddNote accepts", async () => {
    const repo = new MemoryJobRepository();
    const created = await createBenchJob(repo, {
      customerName: "Ada Lovelace",
      deviceLabel: "MacBook Pro 2019",
      reportedFault: "No power",
      phone: "",
      now: new Date("2026-09-29T09:00:00.000Z"),
    });
    if (!created.ok) throw new Error(created.message);
    const text = `${"The charging circuit is open from the jack through to the mainboard and it keeps dropping. ".repeat(4)}`;
    const summary = summaryFromNoteText(text);
    expect(summary.length).toBeGreaterThan(0);
    expect(summary.length).toBeLessThanOrEqual(120);
    expect(summary).not.toContain("\n");
    expect(summary).not.toBe(text.trim().slice(0, 120));
    const parsed = parseAddNote({
      client_request_id: "bench-headline-01",
      ref: created.value.ref,
      text,
      summary,
      tag: "finding",
    });
    expect(parsed.ok).toBe(true);
    const filed = await addBenchNote(repo, {
      ref: created.value.ref,
      text,
      tag: "finding",
      nextMove: null,
      clientRequestId: "bench-headline-01",
      now: new Date("2026-09-29T09:05:00.000Z"),
    });
    expect(filed.ok).toBe(true);
    if (!filed.ok) return;
    expect(filed.value.note.summary).toBe(summary);
    expect(filed.value.note.text).toBe(text.trim());
  });
});

describe("parseNoteBody", () => {
  const long = [
    "The machine posts but the image drops out after a few minutes, which points at the panel rail rather than the SSD.",
    "",
    "Next 2 checks:",
    "1. **Visual inspect mainboard:** look for corrosion around the power stages.",
    "2. **Check the power rail:** confirm the rail stays up when the backlight cuts.",
  ].join("\n");

  it("parses the long diagnosis into a heading and a numbered list", () => {
    const blocks = parseNoteBody(long);
    const heading = blocks.find((block) => block.type === "heading");
    const list = blocks.find((block) => block.type === "ol");
    expect(heading && heading.type === "heading" ? heading.text : "").toContain("Next 2 checks");
    expect(list && list.type === "ol" ? list.start : 0).toBe(1);
    expect(list && list.type === "ol" ? list.items : []).toHaveLength(2);
    expect(isLongNote(long)).toBe(true);
    expect(isLongNote("New logic board - £239")).toBe(false);
    expect(isLongNote("a".repeat(140))).toBe(false);
    expect(isLongNote("a".repeat(141))).toBe(true);
    expect(isLongNote("1. Check the jack")).toBe(true);
  });

  it("covers list shapes and falls back when there is nothing to show", () => {
    expect(parseNoteBody("1. First\n2. Second").find((block) => block.type === "ol")).toMatchObject({ start: 1 });
    expect(parseNoteBody("1) First").find((block) => block.type === "ol")).toMatchObject({ start: 1 });
    expect(parseNoteBody("- One\n* Two\n• Three").find((block) => block.type === "ul")).toMatchObject({
      items: [{ lines: [[{ bold: false, text: "One" }]] }, { lines: [[{ bold: false, text: "Two" }]] }, { lines: [[{ bold: false, text: "Three" }]] }],
    });
    const continued = parseNoteBody("1. Parent\n   more text\n   - child");
    const continuedList = continued.find((block) => block.type === "ol");
    expect(continuedList && continuedList.type === "ol" ? continuedList.items : []).toHaveLength(1);
    expect(continuedList && continuedList.type === "ol" ? continuedList.items[0].lines : []).toHaveLength(3);
    expect(parseNoteBody("3. Third\n4. Fourth").find((block) => block.type === "ol")).toMatchObject({ start: 3 });
    expect(parseNoteBody("1. One\n\n2. Two").filter((block) => block.type === "ol")).toHaveLength(2);
    expect(parseNoteBody("Model 1. Then the board.")).toEqual([
      { type: "p", runs: [{ bold: false, text: "Model 1. Then the board." }] },
    ]);
    expect(parseNoteBody("   \n  ")).toEqual([]);
    expect(parseNoteBody("**unclosed still shows")).toEqual([
      { type: "p", runs: [{ bold: false, text: "**unclosed still shows" }] },
    ]);
    expect(flatten(parseNoteBody(long))).toBe(comparableNoteText(long));
  });

  it("keeps every word of randomised notes", () => {
    let state = 29;
    const next = () => {
      state = (state * 16807) % 2147483647;
      return state / 2147483647;
    };
    const alphabet = " abcdefghijklmnopqrstuvwxyz£.**-:\n1";
    for (let index = 0; index < 20; index += 1) {
      const length = 1 + Math.floor(next() * 400);
      let text = "";
      for (let cursor = 0; cursor < length; cursor += 1) {
        text += alphabet[Math.floor(next() * alphabet.length)];
      }
      if (index === 0) text = `${text}\n1. **Step:** do the thing\n<script>alert(1)</script>`;
      text = text.slice(0, 4000);
      const blocks = parseNoteBody(text);
      const rendered = blocks.length === 0 ? text : blocksPlainText(blocks);
      expect(comparableNoteText(rendered)).toBe(comparableNoteText(text));
    }
  });
});

describe("note feed scope", () => {
  it("keeps the new modules out of the assistant, actions and API", () => {
    const roots = ["src/lib/assistant", "src/lib/actions", "src/app/api"];
    const banned = ["note-view", "note-blocks", "note-list", "save-headline"];
    const files = roots.flatMap((root) => walk(root));
    for (const file of files) {
      const imports = readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => /^\s*import\b/.test(line) || line.includes("require("));
      for (const name of banned) {
        expect(imports.some((line) => line.includes(name)), `${file} imports ${name}`).toBe(false);
      }
    }
  });

  it("leaves toPublicNote without a client request id", () => {
    const note: Note = {
      id: "6b1d4e0a-9c3d-4e0a-8c3d-1a2b3c4d5e6f",
      jobId: "7b1d4e0a-9c3d-4e0a-8c3d-1a2b3c4d5e6f",
      text: "Call 07595 620144 about the board",
      summary: "Call about the board",
      tag: "finding",
      amountGbp: null,
      partDetail: null,
      createdAt: "2026-09-29T09:00:00.000Z",
      editedAt: null,
      clientRequestId: "asst6b1d4e0a9c3d4e0a8c3d1a2b3c4d5e6f",
    };
    const published = toPublicNote(note);
    expect(Object.keys(published).sort()).toEqual(
      ["amount_gbp", "created_at", "edited_at", "id", "part_detail", "summary", "tag", "text"].sort(),
    );
    expect(published).not.toHaveProperty("client_request_id");
    expect(published).not.toHaveProperty("clientRequestId");
    expect(JSON.stringify(published)).not.toContain("client_request");
    expect(noteChipPence(note)).toBeNull();
  });

  it("adds no migration and does not import the notes feed from actions or the API", () => {
    expect(readdirSync("supabase/migrations").sort()).toEqual([
      "20260929120000_jobs.sql",
      "20260929190000_assistant_daily_usage.sql",
    ]);
    const roots = ["src/lib/assistant", "src/lib/actions", "src/app/api"];
    const banned = ["note-view", "note-blocks", "note-list", "save-headline", "now-next", "bench/swipe"];
    const files = roots.flatMap((root) => walk(root));
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const name of banned) {
        expect(text.includes(name), `${file} mentions ${name}`).toBe(false);
      }
    }
    const spec = readFileSync("docs/gpt-actions.openapi.json", "utf8");
    expect(spec).not.toContain("now-next");
    expect(spec).not.toContain("note-view");
    expect(readFileSync("src/app/openapi.json/route.ts", "utf8")).not.toContain("now-next");
  });

  it("caps open note ids at 200", () => {
    const storage = new MemoryStorage();
    const ids = Array.from({ length: NOTE_OPEN_LIMIT + 1 }, (_, index) => `note-${index}`);
    writeNoteOpenIds(storage, "LL-HPS3", ids);
    const stored = readNoteOpenIds(storage, "LL-HPS3");
    expect(stored).toHaveLength(NOTE_OPEN_LIMIT);
    expect(stored).not.toContain("note-0");
    expect(stored.every((id) => id.startsWith("note-"))).toBe(true);
    expect(noteOpenKey("LL-HPS3")).toBe("ll-note-open:LL-HPS3");
    const raw = storage.getItem(noteOpenKey("LL-HPS3")) ?? "";
    expect(raw).not.toContain("clientRequestId");
  });

  it("records the chip contrast pairs", () => {
    expect(contrast(BRAND.accentDeep, BRAND.accentTint)).toBeGreaterThan(10);
    expect(contrast(BRAND.accentLight, BRAND.darkAccentTint)).toBeGreaterThan(9);
    expect(contrast(BRAND.edge, BRAND.canvas)).toBeGreaterThanOrEqual(3);
    expect(contrast(BRAND.darkEdge, BRAND.darkCanvas)).toBeGreaterThanOrEqual(3);
    expect(contrast(BRAND.body, BRAND.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(BRAND.darkBody, BRAND.darkCanvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(BRAND.success, BRAND.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(BRAND.darkSuccess, BRAND.darkCanvas)).toBeGreaterThanOrEqual(4.5);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}
