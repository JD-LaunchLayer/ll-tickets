import { STATUS_LABELS } from "./labels";
import type { TicketStatus } from "./types";

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
