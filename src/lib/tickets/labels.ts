import type { BenchState, ListView, NoteKind } from "./types";

export const BENCH_STATE_LABELS: Record<BenchState, string> = {
  open: "Open",
  waiting: "Waiting",
  done: "Done",
};

export const LIST_VIEW_LABELS: Record<ListView, string> = BENCH_STATE_LABELS;

export const NOTE_KIND_LABELS: Record<NoteKind, string> = {
  note: "Finding",
  finding: "Finding",
  check_outcome: "Update",
  status: "Update",
};

export function ticketWhoDevice(ticket: {
  customer: { name: string } | null;
  device: { label: string } | null;
}): string {
  const name = ticket.customer?.name ?? "Customer";
  const device = ticket.device?.label;
  if (!device || device === "Device") return name;
  return `${name} · ${device}`;
}
