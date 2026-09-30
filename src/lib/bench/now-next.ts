import { latestNote } from "@/lib/bench/latest-note";
import { formatPence, moneyDisplayText, partsSummary, type NoteMoneyInput } from "@/lib/bench/note-view";
import type { JobStatus, PriceBasis } from "@/lib/jobs/domain";

/**
 * Display rules for the Now/Next block and the notes filter.
 * Pure functions only. Not imported by the assistant, the Action API or any route handler.
 * `notes` are newest first, which is how the repository returns them.
 *
 * The sentence is always derived from status and notes. Stored jobs.next_move is not shown.
 */
const SENTENCE_LIMIT = 90;

const START_LINE = "Start: file your first finding.";

export type NextAction =
  | { type: "status"; label: string; status: JobStatus }
  | { type: "note"; label: string };

export type DisplayNextMove = {
  text: string;
  action: NextAction | null;
};

export type DisplayNextMoveInput = {
  status: JobStatus;
  /** Stored jobs.next_move. Callers still pass the column. It is never shown. */
  nextMove?: string;
  priceGbp: number | null;
  priceBasis: PriceBasis | null;
  priceAgreedAt: string | null;
  notes: readonly NoteMoneyInput[];
};

export const NOTE_FILTER_IDS = ["all", "finding", "parts", "contact"] as const;

export type NoteFilterId = (typeof NOTE_FILTER_IDS)[number];

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

/**
 * What the Now/Next block and the jobs list show.
 * Always derived from status and notes. A stored next move is ignored.
 */
export function displayNextMove(input: DisplayNextMoveInput): DisplayNextMove {
  const parts = partsSummary(input.notes);
  const hasFinding = input.notes.some((note) => note.tag === "finding");
  const priceSet = input.priceGbp != null;
  const agreed = input.priceBasis === "quote" && input.priceAgreedAt != null;
  const part = partName(input.notes);
  const { status } = input;

  if (status === "collected" || status === "closed_no_repair") return { text: "Job closed.", action: null };
  if (status === "ready") {
    return {
      text: "Ready. Waiting for the customer to collect.",
      action: { type: "status", label: "Mark collected", status: "collected" },
    };
  }
  if (status === "waiting_on_parts") {
    return {
      text: fitPart("Waiting for ", part, ". Chase the supplier."),
      action: { type: "status", label: "Parts arrived", status: "diagnosing" },
    };
  }
  if (status === "waiting_on_customer") {
    if (priceSet && !agreed && input.priceGbp != null) {
      return { text: `Waiting for the customer to approve ${formatPriceGbp(input.priceGbp)}.`, action: null };
    }
    return { text: "Waiting on the customer.", action: null };
  }
  if (parts.count > 0 && !priceSet) {
    return {
      text: `Parts noted (${formatPence(parts.pence)}). Send the customer the quote.`,
      action: { type: "status", label: "Mark waiting on customer", status: "waiting_on_customer" },
    };
  }
  if (parts.count > 0 && agreed) {
    return {
      text: fitPart("Quote agreed. Order ", part, "."),
      action: { type: "status", label: "Mark waiting on parts", status: "waiting_on_parts" },
    };
  }
  if (parts.count > 0) {
    return { text: `Parts noted (${formatPence(parts.pence)}). Decide whether to order.`, action: null };
  }
  if (hasFinding) {
    return {
      text: "Finding recorded. Decide the repair, then note the part.",
      action: { type: "note", label: "Add a note" },
    };
  }
  return { text: START_LINE, action: { type: "note", label: "File a finding" } };
}
