import { plainField } from "@/lib/bench/copy";
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
): Promise<BenchResult<{ job: Job; note: Note }>> {
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
    return { ok: true, value: filed };
  } catch (error) {
    const reason = reasonLine(error);
    return reason
      ? { ok: false, message: "Could not file the note.", reason }
      : { ok: false, message: "Could not file the note." };
  }
}
