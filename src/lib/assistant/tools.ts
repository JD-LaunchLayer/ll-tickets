import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { MODEL_FAILED } from "@/lib/assistant/copy";
import { stripForModel } from "@/lib/assistant/privacy";
import { JOB_STATUSES, jobEcho, summaryLine, toPublicJob, toPublicNote, type Job } from "@/lib/jobs/domain";
import { canonicalJobRef } from "@/lib/jobs/ref";
import { RepositoryError } from "@/lib/jobs/repository-error";
import { reasonLine } from "@/lib/bench/reason";
import type { JobRepository } from "@/lib/jobs/repository";
import { parseFindJobs } from "@/lib/jobs/validate";

export type AssistantToolContext = {
  repo: JobRepository;
  now: Date;
  scopeRef: string | null;
  phones: Set<string>;
  reasons: string[];
};

function remember(ctx: AssistantToolContext, job: Job | null | undefined) {
  if (job?.phone) ctx.phones.add(job.phone);
}

function forModel(ctx: AssistantToolContext, value: unknown) {
  return stripForModel(value, [...ctx.phones]);
}

function failed(ctx: AssistantToolContext, error: unknown) {
  if (error instanceof RepositoryError) {
    const reason = reasonLine(error);
    if (reason) ctx.reasons.push(reason);
  }
  return forModel(ctx, { ok: false, error: MODEL_FAILED });
}

function reject(ctx: AssistantToolContext, error: string) {
  return forModel(ctx, { ok: false, error });
}

function resolveRef(
  raw: string | undefined,
  ctx: AssistantToolContext,
): { ok: true; ref: string } | { ok: false; error: string } {
  const candidate = raw?.trim() || ctx.scopeRef || "";
  if (!candidate) return { ok: false, error: "Which job? Ask for the ref." };
  const ref = canonicalJobRef(candidate);
  if (!ref) return { ok: false, error: "ref must look like LL-4K7M." };
  return { ok: true, ref };
}

const refField = z
  .string()
  .optional()
  .describe("Job ref, like LL-4K7M. Omit when this chat is already about that job.");

const FIND_STATUSES = ["active", ...JOB_STATUSES] as const;

/** Read tools only. Notes are filed on the job page, or with Save to notes. */
export function createAssistantTools(ctx: AssistantToolContext): ToolSet {
  return {
    get_job: tool({
      description:
        "Read one job, its notes, and photo captions. No photo files and no phone number are returned.",
      inputSchema: z.object({ ref: refField }),
      execute: async (input) => {
        try {
          const ref = resolveRef(input.ref, ctx);
          if (!ref.ok) return reject(ctx, ref.error);
          const job = await ctx.repo.getJobByRef(ref.ref);
          remember(ctx, job);
          if (!job) return reject(ctx, "No job with that ref.");
          const notes = await ctx.repo.listNotes(job.id);
          const photos = await ctx.repo.listPhotoCaptions(job.id);
          return forModel(ctx, {
            ok: true,
            ...jobEcho(job),
            job: toPublicJob(job),
            notes: notes.map(toPublicNote),
            photo_count: photos.count,
            photo_captions: photos.captions,
          });
        } catch (error) {
          return failed(ctx, error);
        }
      },
    }),

    find_jobs: tool({
      description:
        "Search jobs by customer name, device, ref, or status, including past faults. If status is omitted, only active jobs come back. If more than one could match, ask which ref. No phone numbers are returned.",
      inputSchema: z.object({
        customer_name: z.string().optional(),
        device: z.string().optional(),
        ref: z.string().optional(),
        status: z.enum(FIND_STATUSES).optional(),
      }),
      execute: async (input) => {
        try {
          const url = new URL("https://jobs.local/api/actions/jobs");
          if (input.customer_name) url.searchParams.set("customer_name", input.customer_name);
          if (input.device) url.searchParams.set("device", input.device);
          if (input.ref) url.searchParams.set("ref", input.ref);
          if (input.status) url.searchParams.set("status", input.status);
          const parsed = parseFindJobs(url);
          if (!parsed.ok) return reject(ctx, parsed.message);
          const matches = await ctx.repo.findJobs(parsed.value);
          for (const match of matches) remember(ctx, match.job);
          return forModel(ctx, {
            ok: true,
            jobs: matches.map(({ job, lastNoteSummary }) => ({
              ref: job.ref,
              customer_name: job.customerName,
              device_label: job.deviceLabel,
              status: job.status,
              next_move: job.nextMove,
              last_note_summary: lastNoteSummary,
              summary_line: summaryLine({
                ref: job.ref,
                customerName: job.customerName,
                deviceLabel: job.deviceLabel,
                status: job.status,
                nextMove: job.nextMove,
                lastNoteSummary,
              }),
            })),
          });
        } catch (error) {
          return failed(ctx, error);
        }
      },
    }),
  };
}
