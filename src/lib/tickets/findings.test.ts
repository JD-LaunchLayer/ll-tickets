import { describe, expect, it } from "vitest";
import {
  findingNotes,
  nextMoveFromBody,
  oneLiner,
  parseNextPrefix,
  threadFromNotes,
} from "./findings";
import type { TicketNote } from "./types";

function note(
  overrides: Partial<TicketNote> & Pick<TicketNote, "body">,
): TicketNote {
  return {
    id: overrides.id ?? "n1",
    ticket_id: "t1",
    kind: overrides.kind ?? "note",
    body: overrides.body,
    created_by: null,
    created_at: overrides.created_at ?? "2026-09-15T10:00:00.000Z",
  };
}

describe("next: / todo: from a jot", () => {
  it("reads next: and todo: prefixes, otherwise omits", () => {
    expect(parseNextPrefix("next: order PMIC")).toBe("order PMIC");
    expect(parseNextPrefix("TODO: wait for board")).toBe("wait for board");
    expect(parseNextPrefix("Next :  ring customer")).toBe("ring customer");
    expect(parseNextPrefix("board traced, 3v3 missing")).toBeNull();
    expect(parseNextPrefix("next:")).toBeNull();
  });

  it("picks a next line from anywhere in the jot", () => {
    expect(nextMoveFromBody("Board traced\nnext: order PMIC")).toBe("order PMIC");
    expect(nextMoveFromBody("just a finding")).toBeNull();
  });
});

describe("threadFromNotes", () => {
  it("uses the latest user jot as the finding and ignores status lines", () => {
    const thread = threadFromNotes(
      [
        note({
          id: "s",
          kind: "status",
          body: "Opened.",
          created_at: "2026-09-15T12:00:00.000Z",
        }),
        note({
          id: "a",
          body: "Board traced, 3v3 missing",
          created_at: "2026-09-15T11:00:00.000Z",
        }),
        note({
          id: "b",
          body: "Won't power on",
          created_at: "2026-09-15T10:00:00.000Z",
        }),
      ],
      "Won't charge",
    );
    expect(thread.finding).toBe("Board traced, 3v3 missing");
    expect(thread.nextMove).toBeNull();
  });

  it("falls back to the symptom when there are no findings yet", () => {
    const thread = threadFromNotes(
      [note({ kind: "status", body: "Opened." })],
      "Won't charge",
    );
    expect(thread.finding).toBe("Won't charge");
    expect(thread.nextMove).toBeNull();
  });

  it("keeps an earlier next: after a later finding", () => {
    const thread = threadFromNotes([
      note({
        id: "later",
        body: "3v3 rail still dead",
        created_at: "2026-09-15T12:00:00.000Z",
      }),
      note({
        id: "earlier",
        body: "next: order PMIC",
        created_at: "2026-09-15T11:00:00.000Z",
      }),
    ]);
    expect(thread.finding).toBe("3v3 rail still dead");
    expect(thread.nextMove).toBe("order PMIC");
  });

  it("uses the newest next: when more than one exists", () => {
    const thread = threadFromNotes([
      note({
        id: "later",
        body: "next: ring customer",
        created_at: "2026-09-15T12:00:00.000Z",
      }),
      note({
        id: "earlier",
        body: "next: order PMIC",
        created_at: "2026-09-15T11:00:00.000Z",
      }),
    ]);
    expect(thread.nextMove).toBe("ring customer");
  });

  it("splits a jot that is both a finding and a next line", () => {
    const thread = threadFromNotes([
      note({ body: "Connector crushed\ntodo: source a lid" }),
    ]);
    expect(thread.finding).toBe("Connector crushed");
    expect(thread.nextMove).toBe("source a lid");
  });

  it("uses a next-only jot as next, with symptom as the finding", () => {
    const thread = threadFromNotes(
      [note({ body: "next: ring customer" })],
      "No power",
    );
    expect(thread.finding).toBe("No power");
    expect(thread.nextMove).toBe("ring customer");
  });

  it("treats finding-kind rows as user jots", () => {
    const notes = [
      note({ kind: "finding", body: "Liquid on the board" }),
      note({ kind: "check_outcome", body: "Check: pass" }),
    ];
    expect(findingNotes(notes)).toHaveLength(1);
    expect(threadFromNotes(notes).finding).toBe("Liquid on the board");
  });
});

describe("oneLiner", () => {
  it("takes the first line and trims long jots", () => {
    expect(oneLiner("First line\nSecond")).toBe("First line");
    const long = "x".repeat(100);
    expect(oneLiner(long).endsWith("…")).toBe(true);
    expect(oneLiner(long).length).toBe(88);
  });
});
