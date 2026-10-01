import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { BENCH_DEFAULT_NEXT_MOVE } from "@/lib/bench/jobs";
import {
  displayNextMove,
  emptyFilterMessage,
  filterNotes,
  filterChipAriaLabel,
  filterChipShowsCount,
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

describe("displayNextMove", () => {
  it("gives a waiting-on-parts job the part sentence and ignores the stored next move", () => {
    const result = displayNextMove(
      input({
        status: "waiting_on_parts",
        nextMove: "Order a new battery",
        notes: [board, finding, { tag: "finding", text: "A long ask note.", amountGbp: null }],
      }),
    );
    expect(result).toEqual({
      text: "Waiting for Placeholder logic board. Chase the supplier.",
      action: statusAction("Parts arrived", "diagnosing"),
    });
    expect(result.text.length).toBeLessThanOrEqual(90);
    expect(result.text).not.toContain("battery");
    expect(result.text).not.toBe(DEFAULT);
  });

  it.each([
    {
      name: "collected",
      partial: { status: "collected" as const },
      text: "Job closed.",
      action: null,
    },
    {
      name: "closed",
      partial: { status: "closed_no_repair" as const },
      text: "Job closed.",
      action: null,
    },
    {
      name: "ready",
      partial: { status: "ready" as const },
      text: "Ready to collect. Waiting for the customer to collect.",
      action: statusAction("Mark collected", "collected"),
    },
    {
      name: "waiting on parts",
      partial: { status: "waiting_on_parts" as const, notes: [board] },
      text: "Waiting for Placeholder logic board. Chase the supplier.",
      action: statusAction("Parts arrived", "diagnosing"),
    },
    {
      name: "waiting on parts with no parts note",
      partial: { status: "waiting_on_parts" as const },
      text: "Waiting for the part. Chase the supplier.",
      action: statusAction("Parts arrived", "diagnosing"),
    },
    {
      name: "waiting on customer with a price",
      partial: { status: "waiting_on_customer" as const, priceGbp: 239, priceBasis: "estimate" as const },
      text: "Waiting for the customer to approve £239.",
      action: null,
    },
    {
      name: "waiting on customer",
      partial: { status: "waiting_on_customer" as const },
      text: "Waiting on the customer.",
      action: null,
    },
    {
      name: "parts and no price",
      partial: { status: "diagnosing" as const, notes: [board] },
      text: "Parts noted (£239). Send the customer the quote.",
      action: statusAction("Mark waiting on customer", "waiting_on_customer"),
    },
    {
      name: "quote agreed",
      partial: {
        status: "diagnosing" as const,
        notes: [board],
        priceGbp: 239,
        priceBasis: "quote" as const,
        priceAgreedAt: "2026-09-29T20:00:00.000Z",
      },
      text: "Quote agreed. Order Placeholder logic board.",
      action: statusAction("Mark waiting on parts", "waiting_on_parts"),
    },
    {
      name: "parts and a price that is not agreed",
      partial: { status: "diagnosing" as const, notes: [board], priceGbp: 239, priceBasis: "estimate" as const },
      text: "Parts noted (£239). Decide whether to order.",
      action: null,
    },
    {
      name: "finding and no parts",
      partial: { status: "diagnosing" as const, notes: [finding] },
      text: "Finding recorded. Decide the repair, then note the part.",
      action: { type: "note" as const, label: "Add a note" },
    },
    {
      name: "new with no notes",
      partial: { status: "new" as const },
      text: "Start: file your first finding.",
      action: { type: "note" as const, label: "File a finding" },
    },
    {
      name: "diagnosing with no notes",
      partial: { status: "diagnosing" as const },
      text: "Start: file your first finding.",
      action: { type: "note" as const, label: "File a finding" },
    },
  ])("$name", ({ partial, text, action }) => {
    const result = displayNextMove(input(partial));
    expect(result).toEqual({ text, action });
    expect(result.text.length).toBeLessThanOrEqual(90);
  });

  it("ignores a stored next move in every status", () => {
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
      const derived = displayNextMove(input({ status, notes: [board, finding], priceGbp: 239, priceBasis: "estimate" }));
      const stored = displayNextMove(
        input({
          status,
          nextMove: typed,
          notes: [board, finding],
          priceGbp: 239,
          priceBasis: "estimate",
        }),
      );
      expect(stored.text, status).toBe(derived.text);
      expect(stored.text, status).not.toContain("Call Jordan");
      expect(stored.action, status).toEqual(derived.action);
    }
    expect(displayNextMove(input({ status: "ready", nextMove: typed })).action).toEqual(
      statusAction("Mark collected", "collected"),
    );
    expect(displayNextMove(input({ status: "waiting_on_parts", nextMove: typed })).action).toEqual(
      statusAction("Parts arrived", "diagnosing"),
    );
    expect(displayNextMove(input({ status: "new", nextMove: typed })).text).toBe("Start: file your first finding.");
    expect(displayNextMove(input({ status: "diagnosing", nextMove: typed })).action).toEqual({
      type: "note",
      label: "File a finding",
    });
    expect(displayNextMove(input({ status: "diagnosing", nextMove: typed, notes: [finding] })).action).toEqual({
      type: "note",
      label: "Add a note",
    });
    expect(displayNextMove(input({ status: "waiting_on_customer", nextMove: typed })).text).toBe(
      "Waiting on the customer.",
    );
    expect(displayNextMove(input({ status: "collected", nextMove: typed })).text).toBe("Job closed.");
    expect(displayNextMove(input({ status: "waiting_on_parts", nextMove: DEFAULT, notes: [board] })).text).toBe(
      "Waiting for Placeholder logic board. Chase the supplier.",
    );
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
    expect(filterChipShowsCount(0)).toBe(false);
    expect(filterChipShowsCount(1)).toBe(true);
    expect(filterChipAriaLabel("All", 0)).toBe("All");
    expect(filterChipAriaLabel("All", 8)).toBe("All, 8 notes");
    expect(filterChipAriaLabel("Findings", 2)).toBe("Findings, 2 notes");
    expect(filterChipAriaLabel("Parts", 1)).toBe("Parts, 1 note");
    expect(filterChipAriaLabel("Contact", 0)).toBe("Contact");
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
    const fileNote = actions.slice(actions.indexOf("async function fileNoteAction"), actions.indexOf("async function setStatusAction"));
    expect(fileNote).toContain("nextMove: null");
    expect(fileNote).not.toContain("next_move");
    const where = readFileSync("src/app/bench/where-at.tsx", "utf8");
    expect(where).not.toContain("saveNextMoveAction");
    expect(where).not.toContain("Next move");
    expect(readFileSync("src/app/bench/job-action-bar.tsx", "utf8")).not.toContain("next_move");
    const page = readFileSync("src/app/page.tsx", "utf8");
    expect(page).toContain("withNotes: true");
    expect(page).toContain("notes: row.notes");
    expect(page).not.toContain("next={row.nextMove}");
    expect(page).not.toContain("row.nextMove}");
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}
