import { addBenchNote, type BenchResult } from "@/lib/bench/notes";
import { NOTE_TAGS, type Job, type Note, type NoteTag } from "@/lib/jobs/domain";
import type { JobRepository } from "@/lib/jobs/repository";

/** Finding, unless a hypothesis tag is added to the note enum later. */
export function defaultSaveTag(): NoteTag {
  const tags = NOTE_TAGS as readonly string[];
  if (tags.includes("hypothesis")) return "hypothesis" as NoteTag;
  return "finding";
}

export function isSaveTag(value: string): value is NoteTag {
  return (NOTE_TAGS as readonly string[]).includes(value);
}

/**
 * Files a diagnostic reply only after an explicit confirm.
 * The write goes through addBenchNote, which calls fileNote in record.ts.
 */
export async function saveAssistantFinding(
  repo: JobRepository,
  input: {
    ref: string;
    text: string;
    tag: string;
    confirmed: boolean;
    clientRequestId: string;
    now: Date;
  },
): Promise<BenchResult<{ job: Job; note: Note }>> {
  if (!input.confirmed) {
    return { ok: false, message: "Nothing was saved." };
  }
  if (!isSaveTag(input.tag)) {
    return { ok: false, message: "That tag is not on the record." };
  }
  return addBenchNote(repo, {
    ref: input.ref,
    text: input.text,
    tag: input.tag,
    nextMove: null,
    clientRequestId: input.clientRequestId,
    now: input.now,
  });
}
