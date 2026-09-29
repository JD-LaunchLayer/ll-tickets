import {
  closedAtAfterStatusChange,
  type BackupPosition,
  type Job,
  type JobStatus,
  type Note,
  type NoteTag,
} from "@/lib/jobs/domain";
import type { ResolvedPrice } from "@/lib/jobs/price";
import type { JobRepository } from "@/lib/jobs/repository";

/** Shared with the add_note action. A next move is written only when one is passed. */
export async function fileNote(
  repo: JobRepository,
  input: {
    job: Job;
    text: string;
    summary: string;
    tag: NoteTag | null;
    amountGbp: number | null;
    partDetail: string | null;
    nextMove?: string;
    clientRequestId: string;
    now: Date;
  },
): Promise<{ job: Job; note: Note }> {
  const note = await repo.addNote({
    jobId: input.job.id,
    text: input.text,
    summary: input.summary,
    tag: input.tag,
    amountGbp: input.amountGbp,
    partDetail: input.partDetail,
    createdAt: input.now.toISOString(),
    clientRequestId: input.clientRequestId,
  });
  let current = input.job;
  if (input.nextMove) {
    current = await repo.updateJob(input.job.id, {
      nextMove: input.nextMove,
      updatedAt: input.now.toISOString(),
    });
  }
  return { job: current, note };
}

/** Shared with the set_status action, including the closed_at clock. */
export async function applyStatusChange(
  repo: JobRepository,
  input: {
    job: Job;
    status: JobStatus;
    nextMove?: string;
    price: ResolvedPrice | "unchanged";
    backupPosition?: BackupPosition | null;
    accessGiven?: boolean | null;
    followUpAt?: string | null;
    now: Date;
  },
): Promise<Job> {
  const closedAt = closedAtAfterStatusChange(input.job, input.status, input.now.toISOString());
  const price = input.price;
  return repo.updateJob(input.job.id, {
    status: input.status,
    closedAt,
    updatedAt: input.now.toISOString(),
    ...(input.nextMove ? { nextMove: input.nextMove } : {}),
    ...(price !== "unchanged"
      ? {
          priceGbp: price.priceGbp,
          priceBasis: price.priceBasis,
          priceAgreedAt: price.priceAgreedAt,
        }
      : {}),
    ...(input.backupPosition !== undefined ? { backupPosition: input.backupPosition } : {}),
    ...(input.accessGiven !== undefined ? { accessGiven: input.accessGiven } : {}),
    ...(input.followUpAt !== undefined ? { followUpAt: input.followUpAt } : {}),
  });
}
