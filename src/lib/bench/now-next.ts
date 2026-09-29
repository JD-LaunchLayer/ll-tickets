import { latestNote } from "@/lib/bench/latest-note";
import { formatPence, moneyDisplayText, partsSummary, type NoteMoneyInput } from "@/lib/bench/note-view";
import type { JobStatus, PriceBasis } from "@/lib/jobs/domain";

/**
 * Display rules for the Now/Next block and the notes filter.
 * Pure functions only. Not imported by the assistant, the Action API or any route handler.
 * `notes` are newest first, which is how the repository returns them.
 *
 * The intake default is compared as text. `src/lib/bench/jobs.ts` is server-only, so the
 * literal is repeated here and locked to BENCH_DEFAULT_NEXT_MOVE by the unit test.
 */
const DEFAULT_NEXT_MOVE = "Diagnose the reported fault";

const SENTENCE_LIMIT = 90;

export type NextAction =
  | { type: "status"; label: string; status: JobStatus }
  | { type: "note"; label: string };

export type DisplayNextMove = {
  text: string;
  kind: "stored" | "suggested";
  action: NextAction | null;
};

export type DisplayNextMoveInput = {
  status: JobStatus;
  nextMove: string;
  priceGbp: number | null;
  priceBasis: PriceBasis | null;
  priceAgreedAt: string | null;
  notes: readonly NoteMoneyInput[];
};

export const NOTE_FILTER_IDS = ["all", "finding", "parts", "contact"] as const;

export type NoteFilterId = (typeof NOTE_FILTER_IDS)[number];

export function isDefaultNextMove(nextMove: string): boolean {
  return nextMove.trim().toLowerCase() === DEFAULT_NEXT_MOVE.toLowerCase();
}

export function noteFilterKey(jobRef: string): string {
  return `ll-note-filter:${jobRef}`;
}

export function noteJumpKey(jobRef: string): string {
  return `ll-note-jump:${jobRef}`;
}

export function parseNoteFilter(value: string | null | undefined): NoteFilterId {
  if (value === "all" || value === "finding" || value === "parts" || value === "contact") return value;
  return "all";
}

/** Which chip a note belongs to. Work done, other and untagged are only under All. */
export function noteFilterOf(note: { tag: string | null }): NoteFilterId | null {
  if (note.tag === "finding") return "finding";
  if (note.tag === "parts") return "parts";
  if (note.tag === "customer_contact" || note.tag === "quote_auth") return "contact";
  return null;
}

export function noteVisibleInFilter(tag: string | null, filter: NoteFilterId): boolean {
  if (filter === "all") return true;
  return noteFilterOf({ tag }) === filter;
}

export function filterNotes<T extends { tag: string | null }>(notes: readonly T[], filter: NoteFilterId): T[] {
  if (filter === "all") return [...notes];
  return notes.filter((note) => noteFilterOf(note) === filter);
}

export function noteCounts(notes: readonly { tag: string | null }[]): Record<NoteFilterId, number> {
  const counts: Record<NoteFilterId, number> = { all: notes.length, finding: 0, parts: 0, contact: 0 };
  for (const note of notes) {
    const chip = noteFilterOf(note);
    if (chip) counts[chip] += 1;
  }
  return counts;
}

/** The note shown in row 2, and only when that row is a real Finding. */
export function shownAboveId<T extends { id: string; tag: string | null }>(notes: readonly T[]): string | null {
  const latest = latestNote(notes);
  if (latest.kind !== "finding") return null;
  return latest.note.id;
}

export function emptyFilterMessage(filter: NoteFilterId): string | null {
  if (filter === "finding") return "No findings yet.";
  if (filter === "parts") return "No parts yet.";
  if (filter === "contact") return "No customer contact yet.";
  return null;
}

function formatPriceGbp(pounds: number): string {
  return formatPence(Math.round(pounds * 100));
}

function partName(notes: readonly NoteMoneyInput[]): string {
  const newest = notes.find((note) => note.tag === "parts");
  if (!newest) return "the part";
  const line = moneyDisplayText(newest).split(/\r?\n/, 1)[0]?.replace(/\s+/g, " ").trim() ?? "";
  return line || "the part";
}

function fitPart(prefix: string, name: string, suffix: string): string {
  const full = `${prefix}${name}${suffix}`;
  if (full.length <= SENTENCE_LIMIT) return full;
  const room = SENTENCE_LIMIT - prefix.length - suffix.length - 1;
  if (room < 1) return `${full.slice(0, SENTENCE_LIMIT - 1).trimEnd()}…`;
  return `${prefix}${name.slice(0, room).trimEnd()}…${suffix}`;
}

function suggested(text: string, action: NextAction | null): DisplayNextMove {
  return { text, kind: "suggested", action };
}

/** Status-only rows that still offer a button when the sentence is the user's own text. */
function statusOnlyAction(status: JobStatus): NextAction | null {
  if (status === "ready") return { type: "status", label: "Mark collected", status: "collected" };
  if (status === "waiting_on_parts") return { type: "status", label: "Parts arrived", status: "diagnosing" };
  if (status === "new") return { type: "status", label: "Mark diagnosing", status: "diagnosing" };
  return null;
}

/**
 * What the Now/Next block shows. A user-typed next move is returned verbatim.
 * The intake default is replaced only for display, and only when a rule other than R8 matches.
 */
export function displayNextMove(input: DisplayNextMoveInput): DisplayNextMove {
  const stored: DisplayNextMove = {
    text: input.nextMove,
    kind: "stored",
    action: statusOnlyAction(input.status),
  };
  if (!isDefaultNextMove(input.nextMove)) return stored;

  const parts = partsSummary(input.notes);
  const hasFinding = input.notes.some((note) => note.tag === "finding");
  const priceSet = input.priceGbp != null;
  const agreed = input.priceBasis === "quote" && input.priceAgreedAt != null;
  const part = partName(input.notes);
  const { status } = input;

  if (status === "collected" || status === "closed_no_repair") return suggested("Job closed.", null);
  if (status === "ready") {
    return suggested("Ready. Waiting for the customer to collect.", {
      type: "status",
      label: "Mark collected",
      status: "collected",
    });
  }
  if (status === "waiting_on_parts") {
    return suggested(fitPart("Waiting for ", part, ". Chase the supplier."), {
      type: "status",
      label: "Parts arrived",
      status: "diagnosing",
    });
  }
  if (status === "waiting_on_customer") {
    if (priceSet && !agreed && input.priceGbp != null) {
      return suggested(`Waiting for the customer to approve ${formatPriceGbp(input.priceGbp)}.`, null);
    }
    return suggested("Waiting on the customer.", null);
  }
  if (status === "diagnosing") {
    if (parts.count > 0 && !priceSet) {
      return suggested(`Parts noted (${formatPence(parts.pence)}). Send the customer the quote.`, {
        type: "status",
        label: "Mark waiting on customer",
        status: "waiting_on_customer",
      });
    }
    if (parts.count > 0 && agreed) {
      return suggested(fitPart("Quote agreed. Order ", part, "."), {
        type: "status",
        label: "Mark waiting on parts",
        status: "waiting_on_parts",
      });
    }
    if (parts.count > 0) {
      return suggested(`Parts noted (${formatPence(parts.pence)}). Decide whether to order.`, null);
    }
    if (hasFinding) {
      return suggested("Finding recorded. Decide the repair, then note the part.", {
        type: "note",
        label: "Add a note",
      });
    }
    return { text: input.nextMove, kind: "stored", action: { type: "note", label: "File a finding" } };
  }
  if (status === "new") {
    return suggested("Start diagnosing.", { type: "status", label: "Mark diagnosing", status: "diagnosing" });
  }
  return stored;
}
