import type { BenchState, ListView, NoteKind } from "./types";

export const BENCH_STATE_LABELS: Record<BenchState, string> = {
  open: "Open",
  waiting: "Waiting",
  done: "Done",
};

export const LIST_VIEW_LABELS: Record<ListView, string> = BENCH_STATE_LABELS;

export const NOTE_KIND_LABELS: Record<NoteKind, string> = {
  note: "Note",
  finding: "Note",
  check_outcome: "Update",
  status: "Update",
};
