import type { ArrivalKind, ListView, NoteKind, TicketStatus } from "./types";

export const STATUS_LABELS: Record<TicketStatus, string> = {
  intake: "Intake",
  diagnose: "Diagnose",
  parts: "Parts",
  done: "Done",
};

export const LIST_VIEW_LABELS: Record<ListView, string> = {
  today: "Today",
  active: "Active",
  waiting: "Waiting",
  done: "Done",
};

export const ARRIVAL_LABELS: Record<ArrivalKind, string> = {
  walk_in: "Here now",
  appointment: "Appointment",
};

export const NOTE_KIND_LABELS: Record<NoteKind, string> = {
  note: "Note",
  finding: "Finding",
  check_outcome: "Do next",
  status: "Status",
};

export function statusLabel(status: TicketStatus): string {
  return STATUS_LABELS[status];
}
