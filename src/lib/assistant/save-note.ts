import type { NoteStatusMove } from "@/lib/bench/auto-status";
import { addBenchNote, type BenchResult } from "@/lib/bench/notes";
import { NOTE_TAGS, type Job, type Note, type NoteTag } from "@/lib/jobs/domain";
import { scrubStoredCustomerName } from "@/lib/jobs/name-scrub";
import { canonicalJobRef } from "@/lib/jobs/ref";
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
): Promise<BenchResult<{ job: Job; note: Note; statusMove: NoteStatusMove | null; nameReplaced: boolean }>> {
  if (!input.confirmed) {
    return { ok: false, message: "Nothing was saved." };
  }
  if (!isSaveTag(input.tag)) {
    return { ok: false, message: "That tag is not on the record." };
  }
  const ref = canonicalJobRef(input.ref);
  const job = ref ? await repo.getJobByRef(ref) : null;
  const scrubbed = job ? scrubStoredCustomerName(input.text, job.customerName) : { text: input.text, replaced: false };
  const filed = await addBenchNote(repo, {
    ref: input.ref,
    text: scrubbed.text,
    tag: input.tag,
    nextMove: null,
    clientRequestId: input.clientRequestId,
    now: input.now,
  });
  if (!filed.ok) return filed;
  return { ok: true, value: { ...filed.value, nameReplaced: scrubbed.replaced } };
}
