import { STATUS_LABELS } from "./labels";
import type { TicketStatus } from "./types";

export const STATUS_ORDER: TicketStatus[] = [
  "intake",
  "diagnose",
  "parts",
  "done",
];

export function nextStatus(current: TicketStatus): TicketStatus | null {
  const i = STATUS_ORDER.indexOf(current);
  if (i < 0 || i >= STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[i + 1];
}

export const MARK_AS_STATUSES = ["diagnose", "parts", "done"] as const;
export type MarkAsStatus = (typeof MARK_AS_STATUSES)[number];

export function isMarkAsStatus(value: string): value is MarkAsStatus {
  return (MARK_AS_STATUSES as readonly string[]).includes(value);
}

export function markableStatuses(current: TicketStatus): MarkAsStatus[] {
  return MARK_AS_STATUSES.filter((status) => status !== current);
}

export function markAsLabel(status: MarkAsStatus): string {
  return `Mark as ${STATUS_LABELS[status]}`;
}

export function markAsNoteBody(status: MarkAsStatus): string {
  return `Marked as ${STATUS_LABELS[status]}.`;
}
