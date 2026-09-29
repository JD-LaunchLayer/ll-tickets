export type LatestNote<T> =
  | { kind: "finding"; note: T }
  | { kind: "note"; note: T }
  | { kind: "empty" };

/**
 * Newest Finding, else the newest note of any tag, else nothing.
 * `notes` must already be newest first, which is how the repository returns them.
 */
export function latestNote<T extends { tag: string | null }>(notes: readonly T[]): LatestNote<T> {
  const finding = notes.find((note) => note.tag === "finding");
  if (finding) return { kind: "finding", note: finding };
  if (notes.length > 0) return { kind: "note", note: notes[0] };
  return { kind: "empty" };
}

export function latestNoteLabel(kind: LatestNote<unknown>["kind"]): string {
  if (kind === "finding") return "Latest finding";
  if (kind === "note") return "Latest note";
  return "Latest finding";
}
