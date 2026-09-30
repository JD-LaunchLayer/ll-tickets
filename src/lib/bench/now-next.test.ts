import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { BENCH_DEFAULT_NEXT_MOVE } from "@/lib/bench/jobs";
import {
  displayNextMove,
  emptyFilterMessage,
  filterNotes,
  isDefaultNextMove,
  noteCounts,
  noteFilterKey,
  noteFilterOf,
  noteVisibleInFilter,
  parseNoteFilter,
  shownAboveId,
  type DisplayNextMoveInput,
  type NextAction,
} from "@/lib/bench/now-next";
import type { JobStatus } from "@/lib/jobs/domain";

const DEFAULT = BENCH_DEFAULT_NEXT_MOVE;

function input(partial: Partial<DisplayNextMoveInput> & Pick<DisplayNextMoveInput, "status">): DisplayNextMoveInput {
  return {
    nextMove: DEFAULT,
    priceGbp: null,
    priceBasis: null,
    priceAgreedAt: null,
    notes: [],
    ...partial,
  };
}

const board = { tag: "parts" as const, text: "Placeholder logic board - £239", amountGbp: null };
const finding = { tag: "finding" as const, text: "Placeholder: popped capacitor found.", amountGbp: null };

function statusAction(label: string, status: JobStatus): NextAction {
  return { type: "status", label, status };
}

describe("isDefaultNextMove", () => {
  it("matches the intake default and nothing a person typed", () => {
    expect(DEFAULT).toBe("Diagnose the reported fault");
    expect(isDefaultNextMove(DEFAULT)).toBe(true);
    expect(isDefaultNextMove(`  ${DEFAULT.toUpperCase()}  `)).toBe(true);
    expect(isDefaultNextMove("Order the board")).toBe(false);
    expect(isDefaultNextMove("Diagnose the reported fault tomorrow")).toBe(false);
  });
});

describe("displayNextMove", () => {
  it("gives LL-HPS3 the parts suggestion and leaves the stored sentence for the caller", () => {
    const result = displayNextMove(
      input({
        status: "waiting_on_parts",
        notes: [board, finding, { tag: "finding", text: "A long ask note.", amountGbp: null }],
      }),
    );
    expect(result).toEqual({
      text: "Waiting for Placeholder logic board. Chase the supplier.",
      kind: "suggested",
      action: statusAction("Parts arrived", "diagnosing"),
    });
    expect(result.text.length).toBeLessThanOrEqual(90);
    expect(result.text).not.toBe(DEFAULT);
  });

  it.each([
    {
      name: "R1 collected",
      partial: { status: "collected" as const },
      text: "Job closed.",
      kind: "suggested" as const,
      action: null,
    },
    {
      name: "R1 closed",
      partial: { status: "closed_no_repair" as const },
      text: "Job closed.",
      kind: "suggested" as const,
      action: null,
    },
    {
      name: "R2 ready",
      partial: { status: "ready" as const },
      text: "Ready. Waiting for the customer to collect.",
      kind: "suggested" as const,
      action: statusAction("Mark collected", "collected"),
    },
    {
      name: "R3 waiting on parts",
      partial: { status: "waiting_on_parts" as const, notes: [board] },
      text: "Waiting for Placeholder logic board. Chase the supplier.",
      kind: "suggested" as const,
      action: statusAction("Parts arrived", "diagnosing"),
    },
    {
      name: "R3 names the part when there is no parts note",
      partial: { status: "waiting_on_parts" as const },
      text: "Waiting for the part. Chase the supplier.",
      kind: "suggested" as const,
      action: statusAction("Parts arrived", "diagnosing"),
    },
    {
      name: "R4 price not agreed",
      partial: { status: "waiting_on_customer" as const, priceGbp: 239, priceBasis: "estimate" as const },
      text: "Waiting for the customer to approve £239.",
      kind: "suggested" as const,
      action: null,
    },
    {
      name: "R4b waiting on customer",
      partial: { status: "waiting_on_customer" as const },
      text: "Waiting on the customer.",
      kind: "suggested" as const,
      action: null,
    },
    {
      name: "R5 parts and no price",
      partial: { status: "diagnosing" as const, notes: [board] },
      text: "Parts noted (£239). Send the customer the quote.",
      kind: "suggested" as const,
      action: statusAction("Mark waiting on customer", "waiting_on_customer"),
    },
    {
      name: "R6 quote agreed",
      partial: {
        status: "diagnosing" as const,
        notes: [board],
        priceGbp: 239,
        priceBasis: "quote" as const,
        priceAgreedAt: "2026-09-29T20:00:00.000Z",
      },
      text: "Quote agreed. Order Placeholder logic board.",
      kind: "suggested" as const,
      action: statusAction("Mark waiting on parts", "waiting_on_parts"),
    },
    {
      name: "R6b parts and a price that is not agreed",
      partial: { status: "diagnosing" as const, notes: [board], priceGbp: 239, priceBasis: "estimate" as const },
      text: "Parts noted (£239). Decide whether to order.",
      kind: "suggested" as const,
      action: null,
    },
    {
      name: "R7 finding and no parts",
      partial: { status: "diagnosing" as const, notes: [finding] },
      text: "Finding recorded. Decide the repair, then note the part.",
      kind: "suggested" as const,
      action: { type: "note" as const, label: "Add a note" },
    },
    {
      name: "R9 new",
      partial: { status: "new" as const },
      text: "Start diagnosing.",
      kind: "suggested" as const,
      action: statusAction("Mark diagnosing", "diagnosing"),
    },
  ])("$name", ({ partial, text, kind, action }) => {
    const result = displayNextMove(input(partial));
    expect(result).toEqual({ text, kind, action });
    expect(result.text.length).toBeLessThanOrEqual(90);
  });

  it("treats R8 as the stored default, not a suggestion", () => {
    const result = displayNextMove(input({ status: "diagnosing" }));
    expect(result.kind).toBe("stored");
    expect(result.text).toBe(DEFAULT);
    expect(result.action).toEqual({ type: "note", label: "File a finding" });
  });

  it("keeps a user-typed next move in every status and only adds a status-only button", () => {
    const typed = "Call Jordan about the board";
    const statuses: JobStatus[] = [
      "new",
      "diagnosing",
      "waiting_on_parts",
      "waiting_on_customer",
      "ready",
      "collected",
      "closed_no_repair",
    ];
    for (const status of statuses) {
      const result = displayNextMove(
        input({
          status,
          nextMove: typed,
          notes: [board, finding],
          priceGbp: 239,
          priceBasis: "estimate",
        }),
      );
      expect(result.text, status).toBe(typed);
      expect(result.kind, status).toBe("stored");
    }
    expect(displayNextMove(input({ status: "ready", nextMove: typed })).action).toEqual(
      statusAction("Mark collected", "collected"),
    );
    expect(displayNextMove(input({ status: "waiting_on_parts", nextMove: typed })).action).toEqual(
      statusAction("Parts arrived", "diagnosing"),
    );
    expect(displayNextMove(input({ status: "new", nextMove: typed })).action).toEqual(
      statusAction("Mark diagnosing", "diagnosing"),
    );
    expect(displayNextMove(input({ status: "diagnosing", nextMove: typed, notes: [finding] })).action).toBeNull();
    expect(displayNextMove(input({ status: "waiting_on_customer", nextMove: typed, priceGbp: 80 })).action).toBeNull();
    expect(displayNextMove(input({ status: "collected", nextMove: typed })).action).toBeNull();
  });

  it("derives again when the stored text is put back to the default", () => {
    const custom = displayNextMove(input({ status: "waiting_on_parts", nextMove: "Chase the supplier" }));
    expect(custom.kind).toBe("stored");
    const again = displayNextMove(input({ status: "waiting_on_parts", nextMove: DEFAULT, notes: [board] }));
    expect(again.kind).toBe("suggested");
    expect(again.text).toBe("Waiting for Placeholder logic board. Chase the supplier.");
  });

  it("keeps a long part name inside 90 characters and keeps the instruction", () => {
    const long = { tag: "parts" as const, text: `${"logic ".repeat(40)}board - £10`, amountGbp: null };
    const result = displayNextMove(input({ status: "waiting_on_parts", notes: [long] }));
    expect(result.text.length).toBeLessThanOrEqual(90);
    expect(result.text.endsWith(". Chase the supplier.")).toBe(true);
  });

  it("uses the newest parts note when a newer one is first", () => {
    const older = { tag: "parts" as const, text: "Old fan - £12", amountGbp: null };
    const result = displayNextMove(input({ status: "waiting_on_parts", notes: [board, older] }));
    expect(result.text).toContain("Placeholder logic board");
    expect(result.text).not.toContain("Old fan");
  });
});

describe("note filters", () => {
  const notes = [
    { id: "f1", tag: "finding" as const },
    { id: "f2", tag: "finding" as const },
    { id: "p1", tag: "parts" as const },
    { id: "c1", tag: "customer_contact" as const },
    { id: "q1", tag: "quote_auth" as const },
    { id: "w1", tag: "work_done" as const },
    { id: "o1", tag: "other" as const },
    { id: "u1", tag: null },
  ];

  it("maps tags onto the four chips and keeps work, other and untagged on All only", () => {
    expect(noteFilterOf({ tag: "finding" })).toBe("finding");
    expect(noteFilterOf({ tag: "parts" })).toBe("parts");
    expect(noteFilterOf({ tag: "customer_contact" })).toBe("contact");
    expect(noteFilterOf({ tag: "quote_auth" })).toBe("contact");
    expect(noteFilterOf({ tag: "work_done" })).toBeNull();
    expect(noteFilterOf({ tag: "other" })).toBeNull();
    expect(noteFilterOf({ tag: null })).toBeNull();
    expect(noteCounts(notes)).toEqual({ all: 8, finding: 2, parts: 1, contact: 2 });
    expect(filterNotes(notes, "all").map((note) => note.id)).toEqual(notes.map((note) => note.id));
    expect(filterNotes(notes, "finding").map((note) => note.id)).toEqual(["f1", "f2"]);
    expect(filterNotes(notes, "parts").map((note) => note.id)).toEqual(["p1"]);
    expect(filterNotes(notes, "contact").map((note) => note.id)).toEqual(["c1", "q1"]);
    expect(filterNotes(notes, "contact").some((note) => note.tag === "work_done")).toBe(false);
  });

  it("validates the stored filter and marks only a real finding as shown above", () => {
    expect(parseNoteFilter("parts")).toBe("parts");
    expect(parseNoteFilter("nope")).toBe("all");
    expect(parseNoteFilter(null)).toBe("all");
    expect(noteFilterKey("LL-HPS3")).toBe("ll-note-filter:LL-HPS3");
    expect(noteVisibleInFilter("finding", "finding")).toBe(true);
    expect(noteVisibleInFilter("parts", "finding")).toBe(false);
    expect(noteVisibleInFilter("work_done", "all")).toBe(true);
    expect(shownAboveId(notes)).toBe("f1");
    expect(shownAboveId([{ id: "p1", tag: "parts" as const }])).toBeNull();
    expect(shownAboveId([])).toBeNull();
    expect(emptyFilterMessage("finding")).toBe("No findings yet.");
    expect(emptyFilterMessage("parts")).toBe("No parts yet.");
    expect(emptyFilterMessage("contact")).toBe("No customer contact yet.");
    expect(emptyFilterMessage("all")).toBeNull();
  });
});

describe("addendum C scope", () => {
  it("does not import the new modules from the assistant, actions or API, and adds no migration", () => {
    const roots = ["src/lib/assistant", "src/lib/actions", "src/app/api"];
    const files = roots.flatMap((root) => walk(root));
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text.includes("now-next"), file).toBe(false);
      expect(text.includes("bench/swipe"), file).toBe(false);
    }
    expect(readdirSync("supabase/migrations").sort()).toEqual([
      "20260929120000_jobs.sql",
      "20260929190000_assistant_daily_usage.sql",
    ]);
    const source = readFileSync("src/lib/bench/now-next.ts", "utf8");
    expect(source).not.toContain("from \"react\"");
    expect(source).not.toContain("@/lib/bench/jobs");
    expect(source).not.toContain("supabase");
    const swipe = readFileSync("src/lib/bench/swipe.ts", "utf8");
    expect(swipe).not.toContain("from \"react\"");
    const actions = readFileSync("src/app/bench/actions.ts", "utf8");
    expect(actions).toContain('field(formData, "ref")');
    expect(actions).toContain('field(formData, "status")');
    expect(actions).not.toContain("delete");
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}
