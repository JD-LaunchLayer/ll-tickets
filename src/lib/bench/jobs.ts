import { randomUUID } from "crypto";
import { plainField } from "@/lib/bench/copy";
import type { NoteMoneyInput } from "@/lib/bench/note-view";
import { parsePhone } from "@/lib/bench/phone";
import { reasonLine } from "@/lib/bench/reason";
import type { BenchResult } from "@/lib/bench/notes";
import { displayCustomerName, isJobStatus, JOB_STATUSES, type Job, type JobStatus, type PriceBasis } from "@/lib/jobs/domain";
import { applyStatusChange } from "@/lib/jobs/record";
import { canonicalJobRef } from "@/lib/jobs/ref";
import type { JobMatch, JobRepository } from "@/lib/jobs/repository";
import { parseCreateJob, parseNextMove } from "@/lib/jobs/validate";

/** Stored on a new job. The phone view no longer edits it; the list line is derived. */
export const BENCH_DEFAULT_NEXT_MOVE = "Diagnose the reported fault";

export type BenchListRow = {
  ref: string;
  customerName: string;
  deviceLabel: string;
  status: JobStatus;
  nextMove: string;
  priceGbp: number | null;
  priceBasis: PriceBasis | null;
  priceAgreedAt: string | null;
  notes: NoteMoneyInput[];
};

function matchesJob(job: Job, needle: string): boolean {
  if (!needle) return true;
  return (
    displayCustomerName(job.customerName).toLocaleLowerCase("en-GB").includes(needle) ||
    job.customerName.toLocaleLowerCase("en-GB").includes(needle) ||
    job.deviceLabel.toLocaleLowerCase("en-GB").includes(needle) ||
    job.ref.toLocaleLowerCase("en-GB").includes(needle)
  );
}

async function toRows(repo: JobRepository, matches: JobMatch[], withNotes: boolean): Promise<BenchListRow[]> {
  return Promise.all(
    matches.map(async (match) => {
      const notes = withNotes ? await repo.listNotes(match.job.id) : [];
      return {
        ref: match.job.ref,
        customerName: match.job.customerName,
        deviceLabel: match.job.deviceLabel,
        status: match.job.status,
        nextMove: match.job.nextMove,
        priceGbp: match.job.priceGbp,
        priceBasis: match.job.priceBasis,
        priceAgreedAt: match.job.priceAgreedAt,
        notes: notes.map(
          (note): NoteMoneyInput => ({ tag: note.tag, text: note.text, amountGbp: note.amountGbp }),
        ),
      };
    }),
  );
}

export async function listBenchJobs(
  repo: JobRepository,
  input: { search: string; includeFinished: boolean; withNotes?: boolean },
): Promise<{ active: BenchListRow[]; finished: BenchListRow[] }> {
  const needle = input.search.trim().toLocaleLowerCase("en-GB");
  const activeMatches = (await repo.findJobs({ status: "active" })).filter((match) => matchesJob(match.job, needle));
  let finishedMatches: JobMatch[] = [];
  if (input.includeFinished) {
    const collected = await repo.findJobs({ status: "collected" });
    const closed = await repo.findJobs({ status: "closed_no_repair" });
    finishedMatches = [...collected, ...closed]
      .filter((match) => matchesJob(match.job, needle))
      .sort((a, b) => (a.job.updatedAt < b.job.updatedAt ? 1 : a.job.updatedAt > b.job.updatedAt ? -1 : 0));
  }
  const withNotes = input.withNotes === true;
  return {
    active: await toRows(repo, activeMatches, withNotes),
    finished: await toRows(repo, finishedMatches, withNotes),
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
  } catch (error) {
    return failed("Could not create the job.", error);
  }
}

function failed(message: string, error: unknown): { ok: false; message: string; reason?: string } {
  const reason = reasonLine(error);
  return reason ? { ok: false, message, reason } : { ok: false, message };
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
  try {
    const job = await repo.getJobByRef(ref);
    if (!job) return { ok: false, message: "No job with that ref." };
    if (job.status === status) return { ok: true, value: job };
    const updated = await applyStatusChange(repo, {
      job,
      status,
      price: "unchanged",
      now,
    });
    return { ok: true, value: updated };
  } catch (error) {
    return failed("Could not update the status.", error);
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
  try {
    const job = await repo.getJobByRef(ref);
    if (!job) return { ok: false, message: "No job with that ref." };
    if (job.nextMove === parsed.value) return { ok: true, value: job };
    const updated = await repo.updateJob(job.id, {
      nextMove: parsed.value,
      updatedAt: now.toISOString(),
    });
    return { ok: true, value: updated };
  } catch (error) {
    return failed("Could not save the next move.", error);
  }
}
