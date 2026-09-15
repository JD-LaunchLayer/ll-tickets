import type { TicketNote } from "./types";

const NEXT_LINE = /^(?:next|todo)\s*:\s*(.+)$/i;

export function isFindingNote(note: Pick<TicketNote, "kind">): boolean {
  return note.kind === "note" || note.kind === "finding";
}

export function parseNextPrefix(line: string): string | null {
  const match = line.trim().match(NEXT_LINE);
  const value = match?.[1]?.trim();
  return value ? value : null;
}

export function noteLines(body: string): string[] {
  return body
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function oneLiner(text: string, max = 88): string {
  const line = noteLines(text)[0] ?? "";
  if (line.length <= max) return line;
  return `${line.slice(0, max - 1).trimEnd()}…`;
}

export function nextMoveFromBody(body: string): string | null {
  for (const line of noteLines(body)) {
    const next = parseNextPrefix(line);
    if (next) return next;
  }
  return null;
}

function newestFirst(notes: TicketNote[]): TicketNote[] {
  return [...notes].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function findingNotes(notes: TicketNote[]): TicketNote[] {
  return newestFirst(notes).filter(isFindingNote);
}

export type JobThread = {
  finding: string | null;
  nextMove: string | null;
};

/** Last jot as the finding; next: / todo: only if a note actually said so. */
export function threadFromNotes(
  notes: TicketNote[],
  fallbackFinding?: string | null,
): JobThread {
  const userNotes = findingNotes(notes);

  let nextMove: string | null = null;
  for (const note of userNotes) {
    const next = nextMoveFromBody(note.body);
    if (next) {
      nextMove = next;
      break;
    }
  }

  let finding: string | null = null;
  for (const note of userNotes) {
    const findingLine = noteLines(note.body).find((line) => !parseNextPrefix(line));
    if (findingLine) {
      finding = oneLiner(findingLine);
      break;
    }
  }

  const fallback = fallbackFinding?.trim() ? oneLiner(fallbackFinding) : null;
  return {
    finding: finding ?? fallback,
    nextMove,
  };
}
