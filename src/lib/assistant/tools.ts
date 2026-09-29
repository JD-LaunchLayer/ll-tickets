import { randomUUID } from "crypto";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { MODEL_FAILED } from "@/lib/assistant/copy";
import { stripForModel } from "@/lib/assistant/privacy";
import {
  BACKUP_POSITIONS,
  JOB_STATUSES,
  NOTE_TAGS,
  PRICE_BASES,
  jobEcho,
  summaryLine,
  toPublicJob,
  toPublicNote,
  type Job,
  type Note,
} from "@/lib/jobs/domain";
import { canonicalJobRef } from "@/lib/jobs/ref";
import { RepositoryError } from "@/lib/jobs/repository-error";
import { reasonLine } from "@/lib/bench/reason";
import { applyStatusChange, fileNote } from "@/lib/jobs/record";
import type { JobRepository } from "@/lib/jobs/repository";
import {
  parseAddNote,
  parseCreateJob,
  parseEditNote,
  parseFindJobs,
  parseSetStatus,
  type EditNoteInput,
} from "@/lib/jobs/validate";

export type AssistantToolContext = {
  repo: JobRepository;
  now: Date;
  scopeRef: string | null;
  phones: Set<string>;
  reasons: string[];
  lastFiling: { ref: string; customerName: string; deviceLabel: string } | null;
};

export function newClientRequestId(): string {
  return `asst${randomUUID().replaceAll("-", "")}`;
}

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

function noteUnchanged(note: Note, patch: EditNoteInput): boolean {
  if (patch.text !== undefined && patch.text !== note.text) return false;
  if (patch.summary !== undefined && patch.summary !== note.summary) return false;
  if (patch.tag !== undefined && patch.tag !== note.tag) return false;
  if (patch.amountGbp !== undefined && patch.amountGbp !== note.amountGbp) return false;
  if (patch.partDetail !== undefined && patch.partDetail !== note.partDetail) return false;
  return true;
}

function filed(ctx: AssistantToolContext, job: Job) {
  ctx.lastFiling = {
    ref: job.ref,
    customerName: job.customerName,
    deviceLabel: job.deviceLabel,
  };
}

const refField = z
  .string()
  .optional()
  .describe("Job ref, like LL-4K7M. Omit when this chat is already about that job.");

const FIND_STATUSES = ["active", ...JOB_STATUSES] as const;

export function createAssistantTools(ctx: AssistantToolContext): ToolSet {
  return {
    create_job: tool({
      description:
        "File a new job after he confirms. Do not send a phone number. There is no phone field.",
      inputSchema: z.object({
        customer_name: z.string().describe("Customer name."),
        device_label: z.string().describe("Device, in his words."),
        reported_fault: z.string().describe("The fault he reported, in his words."),
        next_move: z.string().describe("One line: what happens next."),
        price_gbp: z.number().nullable().optional().describe("Pounds, only after he confirms a figure."),
        price_basis: z.enum(PRICE_BASES).nullable().optional(),
        price_agreed_at: z.string().nullable().optional().describe("ISO datetime with a timezone, only for a quote."),
        backup_position: z.enum(BACKUP_POSITIONS).nullable().optional(),
        access_given: z.boolean().nullable().optional().describe("True or false. Never a password."),
        follow_up_at: z.string().nullable().optional(),
      }),
      execute: async (input) => {
        try {
          const body: Record<string, unknown> = {
            client_request_id: newClientRequestId(),
            customer_name: input.customer_name,
            device_label: input.device_label,
            reported_fault: input.reported_fault,
            next_move: input.next_move,
          };
          if (input.price_gbp !== undefined) body.price_gbp = input.price_gbp;
          if (input.price_basis !== undefined) body.price_basis = input.price_basis;
          if (input.price_agreed_at !== undefined) body.price_agreed_at = input.price_agreed_at;
          if (input.backup_position !== undefined) body.backup_position = input.backup_position;
          if (input.access_given !== undefined) body.access_given = input.access_given;
          if (input.follow_up_at !== undefined) body.follow_up_at = input.follow_up_at;
          const parsed = parseCreateJob(body, ctx.now);
          if (!parsed.ok) return reject(ctx, parsed.message);
          const job = await ctx.repo.createJob({
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
            createdAt: ctx.now.toISOString(),
            phone: null,
          });
          remember(ctx, job);
          filed(ctx, job);
          return forModel(ctx, { ok: true, ...jobEcho(job), job: toPublicJob(job) });
        } catch (error) {
          return failed(ctx, error);
        }
      },
    }),

    add_note: tool({
      description:
        "File a note in his words. summary is about 100 characters, in your words. Tag only when it is obvious. Send next_move when the next step changed. A note he just dictated does not need a second confirmation.",
      inputSchema: z.object({
        ref: refField,
        text: z.string().describe("His words, lightly tidied."),
        summary: z.string().describe("About 100 characters, in your words."),
        tag: z.enum(NOTE_TAGS).nullable().optional(),
        amount_gbp: z.number().nullable().optional().describe("A part amount. This is not the job price."),
        part_detail: z.string().nullable().optional(),
        next_move: z.string().optional().describe("One line, only when the next step changed."),
      }),
      execute: async (input) => {
        try {
          const ref = resolveRef(input.ref, ctx);
          if (!ref.ok) return reject(ctx, ref.error);
          const body: Record<string, unknown> = {
            client_request_id: newClientRequestId(),
            ref: ref.ref,
            text: input.text,
            summary: input.summary,
          };
          if (input.tag !== undefined) body.tag = input.tag;
          if (input.amount_gbp !== undefined) body.amount_gbp = input.amount_gbp;
          if (input.part_detail !== undefined) body.part_detail = input.part_detail;
          if (input.next_move !== undefined) body.next_move = input.next_move;
          const parsed = parseAddNote(body);
          if (!parsed.ok) return reject(ctx, parsed.message);
          const job = await ctx.repo.getJobByRef(parsed.value.ref);
          remember(ctx, job);
          if (!job) return reject(ctx, "No job with that ref.");
          const filedNote = await fileNote(ctx.repo, {
            job,
            text: parsed.value.text,
            summary: parsed.value.summary,
            tag: parsed.value.tag,
            amountGbp: parsed.value.amountGbp,
            partDetail: parsed.value.partDetail,
            ...(parsed.value.nextMove ? { nextMove: parsed.value.nextMove } : {}),
            clientRequestId: parsed.value.clientRequestId,
            now: ctx.now,
          });
          remember(ctx, filedNote.job);
          filed(ctx, filedNote.job);
          return forModel(ctx, {
            ok: true,
            ...jobEcho(filedNote.job),
            note: toPublicNote(filedNote.note),
            next_move: filedNote.job.nextMove,
          });
        } catch (error) {
          return failed(ctx, error);
        }
      },
    }),

    edit_note: tool({
      description:
        "Correct a note. Send only the fields that change. note_id comes from get_job. The previous wording is kept.",
      inputSchema: z.object({
        ref: refField,
        note_id: z.string().describe("The note id from get_job."),
        text: z.string().optional(),
        summary: z.string().optional(),
        tag: z.enum(NOTE_TAGS).nullable().optional(),
        amount_gbp: z.number().nullable().optional(),
        part_detail: z.string().nullable().optional(),
      }),
      execute: async (input) => {
        try {
          const ref = resolveRef(input.ref, ctx);
          if (!ref.ok) return reject(ctx, ref.error);
          const body: Record<string, unknown> = {
            client_request_id: newClientRequestId(),
            ref: ref.ref,
            note_id: input.note_id,
          };
          if (input.text !== undefined) body.text = input.text;
          if (input.summary !== undefined) body.summary = input.summary;
          if (input.tag !== undefined) body.tag = input.tag;
          if (input.amount_gbp !== undefined) body.amount_gbp = input.amount_gbp;
          if (input.part_detail !== undefined) body.part_detail = input.part_detail;
          const parsed = parseEditNote(body);
          if (!parsed.ok) return reject(ctx, parsed.message);
          const job = await ctx.repo.getJobByRef(parsed.value.ref);
          remember(ctx, job);
          if (!job) return reject(ctx, "No job with that ref.");
          const note = await ctx.repo.getNote(parsed.value.noteId);
          if (!note || note.jobId !== job.id) return reject(ctx, "That note is not on this job.");
          if (noteUnchanged(note, parsed.value)) return reject(ctx, "That note already says this.");
          const edited = await ctx.repo.editNote(note.id, {
            ...(parsed.value.text !== undefined ? { text: parsed.value.text } : {}),
            ...(parsed.value.summary !== undefined ? { summary: parsed.value.summary } : {}),
            ...(parsed.value.tag !== undefined ? { tag: parsed.value.tag } : {}),
            ...(parsed.value.amountGbp !== undefined ? { amountGbp: parsed.value.amountGbp } : {}),
            ...(parsed.value.partDetail !== undefined ? { partDetail: parsed.value.partDetail } : {}),
            editedAt: ctx.now.toISOString(),
          });
          filed(ctx, job);
          return forModel(ctx, { ok: true, ...jobEcho(job), note: toPublicNote(edited.note) });
        } catch (error) {
          return failed(ctx, error);
        }
      },
    }),

    set_status: tool({
      description:
        "Set the status, and optionally the price, next move, access, or backup position. Sending the current status is allowed when only those other fields change. On a job this chat is already about, file a status he just stated without asking again.",
      inputSchema: z.object({
        ref: refField,
        status: z.enum(JOB_STATUSES),
        next_move: z.string().optional(),
        price_gbp: z.number().nullable().optional(),
        price_basis: z.enum(PRICE_BASES).nullable().optional(),
        price_agreed_at: z.string().nullable().optional(),
        backup_position: z.enum(BACKUP_POSITIONS).nullable().optional(),
        access_given: z.boolean().nullable().optional(),
        follow_up_at: z.string().nullable().optional(),
      }),
      execute: async (input) => {
        try {
          const ref = resolveRef(input.ref, ctx);
          if (!ref.ok) return reject(ctx, ref.error);
          const body: Record<string, unknown> = {
            client_request_id: newClientRequestId(),
            ref: ref.ref,
            status: input.status,
          };
          if (input.next_move !== undefined) body.next_move = input.next_move;
          if (input.price_gbp !== undefined) body.price_gbp = input.price_gbp;
          if (input.price_basis !== undefined) body.price_basis = input.price_basis;
          if (input.price_agreed_at !== undefined) body.price_agreed_at = input.price_agreed_at;
          if (input.backup_position !== undefined) body.backup_position = input.backup_position;
          if (input.access_given !== undefined) body.access_given = input.access_given;
          if (input.follow_up_at !== undefined) body.follow_up_at = input.follow_up_at;
          const parsed = parseSetStatus(body, ctx.now);
          if (!parsed.ok) return reject(ctx, parsed.message);
          const job = await ctx.repo.getJobByRef(parsed.value.ref);
          remember(ctx, job);
          if (!job) return reject(ctx, "No job with that ref.");
          const updated = await applyStatusChange(ctx.repo, {
            job,
            status: parsed.value.status,
            ...(parsed.value.nextMove ? { nextMove: parsed.value.nextMove } : {}),
            price: parsed.value.price,
            ...(parsed.value.backupPosition !== undefined
              ? { backupPosition: parsed.value.backupPosition }
              : {}),
            ...(parsed.value.accessGiven !== undefined ? { accessGiven: parsed.value.accessGiven } : {}),
            ...(parsed.value.followUpAt !== undefined ? { followUpAt: parsed.value.followUpAt } : {}),
            now: ctx.now,
          });
          remember(ctx, updated);
          filed(ctx, updated);
          return forModel(ctx, { ok: true, ...jobEcho(updated), job: toPublicJob(updated) });
        } catch (error) {
          return failed(ctx, error);
        }
      },
    }),

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
        "Find jobs by customer name, device, ref, or status. If status is omitted, only active jobs come back. If more than one could match, ask which ref before you write. No phone numbers are returned.",
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
