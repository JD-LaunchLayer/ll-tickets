import { randomUUID } from "crypto";
import { plainField } from "@/lib/bench/copy";
import { parsePhone } from "@/lib/bench/phone";
import type { BenchResult } from "@/lib/bench/notes";
import { isJobStatus, JOB_STATUSES, type Job, type JobStatus } from "@/lib/jobs/domain";
import { applyStatusChange } from "@/lib/jobs/record";
import { canonicalJobRef } from "@/lib/jobs/ref";
import type { JobMatch, JobRepository } from "@/lib/jobs/repository";
import { parseCreateJob, parseNextMove } from "@/lib/jobs/validate";

/** Used when the phone form does not ask for a next move. Editable on the job page. */
export const BENCH_DEFAULT_NEXT_MOVE = "Diagnose the reported fault";

export type BenchListRow = {
  ref: string;
  customerName: string;
  deviceLabel: string;
  status: JobStatus;
  nextMove: string;
};

function toRow(match: JobMatch): BenchListRow {
  return {
    ref: match.job.ref,
    customerName: match.job.customerName,
    deviceLabel: match.job.deviceLabel,
    status: match.job.status,
    nextMove: match.job.nextMove,
  };
}

function matchesSearch(row: BenchListRow, needle: string): boolean {
  if (!needle) return true;
  return (
    row.customerName.toLocaleLowerCase("en-GB").includes(needle) ||
    row.deviceLabel.toLocaleLowerCase("en-GB").includes(needle) ||
    row.ref.toLocaleLowerCase("en-GB").includes(needle)
  );
}

export async function listBenchJobs(
  repo: JobRepository,
  input: { search: string; includeFinished: boolean },
): Promise<{ active: BenchListRow[]; finished: BenchListRow[] }> {
  const active = (await repo.findJobs({ status: "active" })).map(toRow);
  let finished: BenchListRow[] = [];
  if (input.includeFinished) {
    const collected = await repo.findJobs({ status: "collected" });
    const closed = await repo.findJobs({ status: "closed_no_repair" });
    finished = [...collected, ...closed]
      .sort((a, b) => (a.job.updatedAt < b.job.updatedAt ? 1 : a.job.updatedAt > b.job.updatedAt ? -1 : 0))
      .map(toRow);
  }
  const needle = input.search.trim().toLocaleLowerCase("en-GB");
  return {
    active: active.filter((row) => matchesSearch(row, needle)),
    finished: finished.filter((row) => matchesSearch(row, needle)),
  };
}

export async function loadBenchJob(
  repo: JobRepository,
  rawRef: string,
): Promise<{ job: Job; notes: Awaited<ReturnType<JobRepository["listNotes"]>> } | null> {
  const ref = canonicalJobRef(rawRef);
  if (!ref) return null;
  const job = await repo.getJobByRef(ref);
  if (!job) return null;
  const notes = await repo.listNotes(job.id);
  return { job, notes };
}

export async function createBenchJob(
  repo: JobRepository,
  input: {
    customerName: string;
    deviceLabel: string;
    reportedFault: string;
    phone: string;
    now: Date;
  },
): Promise<BenchResult<Job>> {
  const phone = parsePhone(input.phone);
  if (!phone.ok) return phone;

  const parsed = parseCreateJob(
    {
      client_request_id: `bench${randomUUID().replace(/-/g, "")}`,
      customer_name: input.customerName,
      device_label: input.deviceLabel,
      reported_fault: input.reportedFault,
      next_move: BENCH_DEFAULT_NEXT_MOVE,
    },
    input.now,
  );
  if (!parsed.ok) return { ok: false, message: plainField(parsed.message) };

  try {
    const job = await repo.createJob({
      customerName: parsed.value.customerName,
      deviceLabel: parsed.value.deviceLabel,
      reportedFault: parsed.value.reportedFault,
      nextMove: parsed.value.nextMove,
      priceGbp: parsed.value.price.priceGbp,
      priceBasis: parsed.value.price.priceBasis,
      priceAgreedAt: parsed.value.price.priceAgreedAt,
      backupPosition: parsed.value.backupPosition,
      accessGiven: parsed.value.accessGiven,
      followUpAt: parsed.value.followUpAt,
      createdAt: input.now.toISOString(),
      phone: phone.phone,
    });
    return { ok: true, value: job };
  } catch {
    return { ok: false, message: "Could not create the job." };
  }
}

export async function setBenchStatus(
  repo: JobRepository,
  rawRef: string,
  status: string,
  now: Date,
): Promise<BenchResult<Job>> {
  const ref = canonicalJobRef(rawRef);
  if (!ref) return { ok: false, message: "That job ref is not valid." };
  if (!isJobStatus(status)) {
    return { ok: false, message: `Status must be one of: ${JOB_STATUSES.join(", ")}.` };
  }
  const job = await repo.getJobByRef(ref);
  if (!job) return { ok: false, message: "No job with that ref." };
  try {
    const updated = await applyStatusChange(repo, {
      job,
      status,
      price: "unchanged",
      now,
    });
    return { ok: true, value: updated };
  } catch {
    return { ok: false, message: "Could not update the status." };
  }
}

export async function saveBenchNextMove(
  repo: JobRepository,
  rawRef: string,
  nextMove: string,
  now: Date,
): Promise<BenchResult<Job>> {
  const ref = canonicalJobRef(rawRef);
  if (!ref) return { ok: false, message: "That job ref is not valid." };
  const parsed = parseNextMove(nextMove);
  if (!parsed.ok) return { ok: false, message: plainField(parsed.message) };
  const job = await repo.getJobByRef(ref);
  if (!job) return { ok: false, message: "No job with that ref." };
  if (job.nextMove === parsed.value) return { ok: true, value: job };
  try {
    const updated = await repo.updateJob(job.id, {
      nextMove: parsed.value,
      updatedAt: now.toISOString(),
    });
    return { ok: true, value: updated };
  } catch {
    return { ok: false, message: "Could not save the next move." };
  }
}
