import { STATUS_LABELS } from "./labels";
import type { TicketStatus } from "./types";

export type DoNextOutcome = {
  id: string;
  label: string;
  status?: TicketStatus;
  waiting?: boolean;
};

export type DoNextCheck = {
  next: string;
  why: string;
  outcomes: DoNextOutcome[];
};

const STATUS_CHECKS: Record<Exclude<TicketStatus, "done">, DoNextCheck> = {
  intake: {
    next: "Start diagnose",
    why: "Job is in. Confirm the symptom on the bench and begin looking at the device.",
    outcomes: [
      { id: "start-diagnose", label: "Started diagnose", status: "diagnose" },
      { id: "wait-customer", label: "Waiting on customer", waiting: true },
    ],
  },
  diagnose: {
    next: "Find the fault",
    why: "Record what you found, or park the job if you are blocked.",
    outcomes: [
      { id: "fault-parts", label: "Fault found — parts", status: "parts" },
      { id: "fixed-done", label: "Fixed — done", status: "done" },
      { id: "wait-customer", label: "Waiting on customer", waiting: true },
    ],
  },
  parts: {
    next: "Fit or chase parts",
    why: "Fit what you have, or mark waiting if the part is not here.",
    outcomes: [
      { id: "fitted-done", label: "Fitted — done", status: "done" },
      { id: "wait-parts", label: "Waiting on parts", waiting: true },
    ],
  },
};

const WAITING_CHECK: DoNextCheck = {
  next: "Resume this job",
  why: "Parked until the part or customer is ready.",
  outcomes: [{ id: "resume", label: "Back on the bench", waiting: false }],
};

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

export function getDoNext(ticket: {
  status: TicketStatus;
  waiting: boolean;
}): DoNextCheck | null {
  if (ticket.status === "done") return null;
  if (ticket.waiting) return WAITING_CHECK;
  return STATUS_CHECKS[ticket.status];
}

export function outcomeById(
  check: DoNextCheck | null,
  outcomeId: string,
): DoNextOutcome | null {
  if (!check) return null;
  return check.outcomes.find((o) => o.id === outcomeId) ?? null;
}

export function outcomeNoteBody(check: DoNextCheck, outcome: DoNextOutcome): string {
  const bits = [`${check.next} — ${outcome.label}`];
  if (outcome.status) bits.push(`Status: ${STATUS_LABELS[outcome.status]}`);
  if (outcome.waiting === true) bits.push("Marked waiting.");
  if (outcome.waiting === false) bits.push("Back on the bench.");
  return bits.join(" ");
}

export function advanceLabel(current: TicketStatus): string | null {
  const next = nextStatus(current);
  if (!next) return null;
  return `Advance to ${STATUS_LABELS[next]}`;
}
