import { autoStatusForNote, type NoteStatusMove } from "@/lib/bench/auto-status";
import { plainField } from "@/lib/bench/copy";
import { setBenchStatus } from "@/lib/bench/jobs";
import { derivedHeadline } from "@/lib/bench/note-view";
import { reasonLine } from "@/lib/bench/reason";
import type { Job, Note } from "@/lib/jobs/domain";
import { fileNote } from "@/lib/jobs/record";
import type { JobRepository } from "@/lib/jobs/repository";
import { parseAddNote } from "@/lib/jobs/validate";

export type BenchResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string; reason?: string };

/**
 * Headline stored on a newly filed note. One line, at most 120 characters,
 * so it still passes parseAddNote and notes_summary_length.
 */
export function summaryFromNoteText(text: string): string {
  const headline = derivedHeadline(text).replace(/[\r\n]+/g, " ").trim();
  const line = headline || (text.trim().split(/\r?\n/, 1)[0]?.trim() ?? "");
  return line.slice(0, 120).trim();
}

/**
 * Files a note the same way add_note does: parseAddNote, then fileNote.
 * A blank next move leaves the current one. The same next move is not written again.
 * Phone view and Ask save-to-notes both come through here, so the tag can move the status.
 * The Action API files with fileNote in record.ts and does not call this.
 * A failed status write still returns the filed note.
 */
export async function addBenchNote(
  repo: JobRepository,
  input: {
    ref: string;
    text: string;
    tag: string | null;
    nextMove: string | null;
    clientRequestId: string;
    now: Date;
  },
): Promise<BenchResult<{ job: Job; note: Note; statusMove: NoteStatusMove | null }>> {
  const body: Record<string, unknown> = {
    client_request_id: input.clientRequestId,
    ref: input.ref,
    text: input.text,
    summary: summaryFromNoteText(input.text),
  };
  if (input.tag) body.tag = input.tag;
  const nextMove = input.nextMove?.trim() ?? "";
  if (nextMove) body.next_move = nextMove;

  const parsed = parseAddNote(body);
  if (!parsed.ok) return { ok: false, message: plainField(parsed.message) };

  try {
    const job = await repo.getJobByRef(parsed.value.ref);
    if (!job) return { ok: false, message: "No job with that ref." };

    const move = parsed.value.nextMove && parsed.value.nextMove !== job.nextMove ? parsed.value.nextMove : undefined;
    const filed = await fileNote(repo, {
      job,
      text: parsed.value.text,
      summary: parsed.value.summary,
      tag: parsed.value.tag,
      amountGbp: parsed.value.amountGbp,
      partDetail: parsed.value.partDetail,
      ...(move ? { nextMove: move } : {}),
      clientRequestId: parsed.value.clientRequestId,
      now: input.now,
    });
    const target = autoStatusForNote(filed.note.tag, filed.job.status);
    if (!target) return { ok: true, value: { ...filed, statusMove: null } };
    const previous = filed.job.status;
    const moved = await setBenchStatus(repo, filed.job.ref, target, input.now);
    if (!moved.ok || moved.value.status !== target) {
      return { ok: true, value: { job: filed.job, note: filed.note, statusMove: { applied: false } } };
    }
    return {
      ok: true,
      value: {
        job: moved.value,
        note: filed.note,
        statusMove: { applied: true, from: previous, to: target },
      },
    };
  } catch (error) {
    const reason = reasonLine(error);
    return reason
      ? { ok: false, message: "Could not file the note.", reason }
      : { ok: false, message: "Could not file the note." };
  }
}
