import { STATUS_LABELS, type JobStatus } from "@/lib/jobs/domain";

/**
 * Which status a phone-view note tag should move a job to.
 * Pure. The Action API does not call this: GPT notes go through fileNote in record.ts.
 * Ready to collect, collected and closed never move. The only step back is Quote agreed,
 * from waiting on the customer to diagnosing.
 */
const PARTS_FROM: readonly JobStatus[] = ["new", "diagnosing", "waiting_on_customer"];
const DONE_FROM: readonly JobStatus[] = ["new", "diagnosing", "waiting_on_parts"];
const HELD: readonly JobStatus[] = ["ready", "collected", "closed_no_repair"];

export type NoteStatusMove =
  | { applied: true; from: JobStatus; to: JobStatus }
  | { applied: false };

export function autoStatusForNote(tag: string | null | undefined, currentStatus: JobStatus): JobStatus | null {
  if (HELD.includes(currentStatus)) return null;
  const next = targetFor(tag, currentStatus);
  if (!next || next === currentStatus) return null;
  return next;
}

function targetFor(tag: string | null | undefined, currentStatus: JobStatus): JobStatus | null {
  if (tag === "parts" && PARTS_FROM.includes(currentStatus)) return "waiting_on_parts";
  if (tag === "work_done" && DONE_FROM.includes(currentStatus)) return "waiting_on_customer";
  if (tag === "quote_auth" && currentStatus === "waiting_on_customer") return "diagnosing";
  if (tag === "finding" && currentStatus === "new") return "diagnosing";
  return null;
}

/** Quiet line when the tag does not move the job. The moved line names the new status. */
export function noteFiledNotice(
  move: NoteStatusMove | null,
  quietLine: string,
): { notice: string; undoStatus: JobStatus | null } {
  if (move?.applied) {
    return { notice: `Moved to ${STATUS_LABELS[move.to]}.`, undoStatus: move.from };
  }
  if (move && !move.applied) {
    return { notice: "Note filed. Status did not change.", undoStatus: null };
  }
  return { notice: quietLine, undoStatus: null };
}
