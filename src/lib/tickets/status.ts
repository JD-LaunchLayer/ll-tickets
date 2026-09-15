import { isFutureShopDay } from "./datetime";
import type { BenchState, TicketStatus } from "./types";

export function isBenchState(value: string): value is BenchState {
  return value === "open" || value === "waiting" || value === "done";
}

export function storedBenchState(ticket: {
  status: TicketStatus;
  waiting: boolean;
}): BenchState {
  if (ticket.status === "done") return "done";
  if (ticket.waiting) return "waiting";
  return "open";
}

export function listBenchState(
  ticket: { status: TicketStatus; waiting: boolean; due_at: string },
  now = new Date(),
): BenchState {
  if (ticket.status === "done") return "done";
  if (ticket.waiting || isFutureShopDay(new Date(ticket.due_at), now)) {
    return "waiting";
  }
  return "open";
}

export function patchForBenchState(
  next: BenchState,
  current: TicketStatus,
): { status: TicketStatus; waiting: boolean } {
  if (next === "done") return { status: "done", waiting: false };
  const openStatus: TicketStatus = current === "done" ? "intake" : current;
  return { status: openStatus, waiting: next === "waiting" };
}

export function benchStateNote(state: BenchState): string {
  if (state === "open") return "Open.";
  if (state === "waiting") return "Waiting.";
  return "Done.";
}
