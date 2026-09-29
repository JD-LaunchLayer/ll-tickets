import { bearerMatches } from "@/lib/auth/api-key";
import { takeRateLimit } from "@/lib/auth/rate-limit";
import type { CalendarPort } from "@/lib/calendar/types";
import {
  closedAtAfterStatusChange,
  jobEcho,
  summaryLine,
  toPublicJob,
  toPublicNote,
  type Job,
  type Note,
} from "@/lib/jobs/domain";
import { canonicalJobRef } from "@/lib/jobs/ref";
import type { JobRepository } from "@/lib/jobs/repository";
import {
  parseAddNote,
  parseCollection,
  parseCreateJob,
  parseEditNote,
  parseFindJobs,
  parseSetStatus,
  readJsonObject,
  requestHash,
  type EditNoteInput,
} from "@/lib/jobs/validate";

export type ActionOperation =
  | "create_job"
  | "add_note"
  | "edit_note"
  | "set_status"
  | "get_job"
  | "find_jobs"
  | "create_collection_event";

export type ActionRuntime = {
  repo: JobRepository | null;
  now: () => Date;
  calendar: CalendarPort;
  apiKey: string;
  configurationError: string | null;
  rateLimit: { limit: number; windowMs: number };
};

function json(status: number, body: unknown, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set("content-type", "application/json");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(body), { status, headers });
}

function fail(status: number, code: string, message: string, job?: Job | null, ref?: string): Response {
  return json(status, {
    error: { code, message },
    ...(job ? jobEcho(job) : ref ? { ref } : {}),
  });
}

function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return "unknown";
}

function noteUnchanged(note: Note, patch: EditNoteInput): boolean {
  if (patch.text !== undefined && patch.text !== note.text) return false;
  if (patch.summary !== undefined && patch.summary !== note.summary) return false;
  if (patch.tag !== undefined && patch.tag !== note.tag) return false;
  if (patch.amountGbp !== undefined && patch.amountGbp !== note.amountGbp) return false;
  if (patch.partDetail !== undefined && patch.partDetail !== note.partDetail) return false;
  return true;
}

type WriteOutcome =
  | { ok: true; status: number; body: unknown; jobId: string | null }
  | { ok: false; status: number; body: unknown };

export async function handleAction(
  request: Request,
  operation: ActionOperation,
  runtime: ActionRuntime,
  path: { ref?: string } = {},
): Promise<Response> {
  const limit = takeRateLimit(
    `actions:${clientAddress(request)}`,
    runtime.rateLimit.limit,
    runtime.rateLimit.windowMs,
    runtime.now().getTime(),
  );
  if (!limit.allowed) {
    return json(
      429,
      { error: { code: "rate_limited", message: "Too many requests. Wait a moment and try again." } },
      { "retry-after": String(limit.retryAfterSeconds) },
    );
  }

  if (!runtime.apiKey) {
    return fail(503, "not_configured", runtime.configurationError ?? "The Action API is not configured.");
  }
  if (!bearerMatches(request.headers.get("authorization"), runtime.apiKey)) {
    return fail(401, "unauthorised", "The API key was missing or not recognised.");
  }
  if (!runtime.repo) {
    return fail(503, "not_configured", runtime.configurationError ?? "The Action API is not configured.");
  }

  const repo = runtime.repo;
  try {
    if (operation === "find_jobs") return await findJobs(request, repo);
    if (operation === "get_job") return await getJob(request, repo, path.ref);
    return await write(request, operation, runtime, repo);
  } catch {
    return fail(500, "internal_error", "The action failed.");
  }
}

async function write(
  request: Request,
  operation: Exclude<ActionOperation, "find_jobs" | "get_job">,
  runtime: ActionRuntime,
  repo: JobRepository,
): Promise<Response> {
  const raw = await readJsonObject(request);
  if (!raw.ok) return fail(400, "validation_error", raw.message);
  const hash = requestHash(raw.value);
  const now = runtime.now();

  if (operation === "create_job") {
    const parsed = parseCreateJob(raw.value, now);
    if (!parsed.ok) return fail(400, "validation_error", parsed.message);
    return commit(repo, operation, parsed.value.clientRequestId, hash, now, async () => {
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
        createdAt: now.toISOString(),
      });
      return { ok: true, status: 200, body: toPublicJob(job), jobId: job.id };
    });
  }

  if (operation === "add_note") {
    const parsed = parseAddNote(raw.value);
    if (!parsed.ok) return fail(400, "validation_error", parsed.message);
    const job = await repo.getJobByRef(parsed.value.ref);
    if (!job) return fail(404, "not_found", "No job with that ref.", null, parsed.value.ref);
    return commit(repo, operation, parsed.value.clientRequestId, hash, now, async () => {
      const note = await repo.addNote({
        jobId: job.id,
        text: parsed.value.text,
        summary: parsed.value.summary,
        tag: parsed.value.tag,
        amountGbp: parsed.value.amountGbp,
        partDetail: parsed.value.partDetail,
        createdAt: now.toISOString(),
        clientRequestId: parsed.value.clientRequestId,
      });
      let current = job;
      if (parsed.value.nextMove) {
        current = await repo.updateJob(job.id, {
          nextMove: parsed.value.nextMove,
          updatedAt: now.toISOString(),
        });
      }
      return {
        ok: true,
        status: 200,
        body: { ...jobEcho(current), note: toPublicNote(note) },
        jobId: current.id,
      };
    });
  }

  if (operation === "edit_note") {
    const parsed = parseEditNote(raw.value);
    if (!parsed.ok) return fail(400, "validation_error", parsed.message);
    const job = await repo.getJobByRef(parsed.value.ref);
    if (!job) return fail(404, "not_found", "No job with that ref.", null, parsed.value.ref);
    const note = await repo.getNote(parsed.value.noteId);
    if (!note || note.jobId !== job.id) {
      return fail(404, "not_found", "That note is not on this job.", job);
    }
    if (noteUnchanged(note, parsed.value)) {
      return fail(400, "validation_error", "That note already says this.", job);
    }
    return commit(repo, operation, parsed.value.clientRequestId, hash, now, async () => {
      const edited = await repo.editNote(note.id, {
        ...(parsed.value.text !== undefined ? { text: parsed.value.text } : {}),
        ...(parsed.value.summary !== undefined ? { summary: parsed.value.summary } : {}),
        ...(parsed.value.tag !== undefined ? { tag: parsed.value.tag } : {}),
        ...(parsed.value.amountGbp !== undefined ? { amountGbp: parsed.value.amountGbp } : {}),
        ...(parsed.value.partDetail !== undefined ? { partDetail: parsed.value.partDetail } : {}),
        editedAt: now.toISOString(),
      });
      return {
        ok: true,
        status: 200,
        body: { ...jobEcho(job), note: toPublicNote(edited.note) },
        jobId: job.id,
      };
    });
  }

  if (operation === "set_status") {
    const parsed = parseSetStatus(raw.value, now);
    if (!parsed.ok) return fail(400, "validation_error", parsed.message);
    const job = await repo.getJobByRef(parsed.value.ref);
    if (!job) return fail(404, "not_found", "No job with that ref.", null, parsed.value.ref);
    const closedAt = closedAtAfterStatusChange(job, parsed.value.status, now.toISOString());
    return commit(repo, operation, parsed.value.clientRequestId, hash, now, async () => {
      const price = parsed.value.price;
      const updated = await repo.updateJob(job.id, {
        status: parsed.value.status,
        closedAt,
        updatedAt: now.toISOString(),
        ...(parsed.value.nextMove ? { nextMove: parsed.value.nextMove } : {}),
        ...(price !== "unchanged"
          ? {
              priceGbp: price.priceGbp,
              priceBasis: price.priceBasis,
              priceAgreedAt: price.priceAgreedAt,
            }
          : {}),
        ...(parsed.value.backupPosition !== undefined
          ? { backupPosition: parsed.value.backupPosition }
          : {}),
        ...(parsed.value.accessGiven !== undefined ? { accessGiven: parsed.value.accessGiven } : {}),
        ...(parsed.value.followUpAt !== undefined ? { followUpAt: parsed.value.followUpAt } : {}),
      });
      return { ok: true, status: 200, body: toPublicJob(updated), jobId: updated.id };
    });
  }

  const parsed = parseCollection(raw.value);
  if (!parsed.ok) return fail(400, "validation_error", parsed.message);
  const job = await repo.getJobByRef(parsed.value.ref);
  if (!job) return fail(404, "not_found", "No job with that ref.", null, parsed.value.ref);
  const calendarStatus = runtime.calendar.status();
  if (!calendarStatus.configured) {
    return fail(
      503,
      "calendar_not_configured",
      `Google Calendar is not configured (${calendarStatus.missing.join(", ")}). The collection time was not saved.`,
      job,
    );
  }
  return commit(repo, operation, parsed.value.clientRequestId, hash, now, async () => {
    let event: { eventId: string; action: "created" | "updated" };
    try {
      event = await runtime.calendar.upsertPrivateEvent({
        eventId: job.calendarEventId,
        summary: `Collect ${job.ref} · ${job.customerName} · ${job.deviceLabel}`,
        description: `Collection for ${job.customerName} — ${job.deviceLabel} (${job.ref}). Private workshop entry. The customer is not invited.`,
        startsAt: parsed.value.collectionAt,
      });
    } catch {
      return {
        ok: false,
        status: 502,
        body: {
          ...jobEcho(job),
          error: {
            code: "calendar_failed",
            message: "Google Calendar did not accept the entry. The collection time was not saved.",
          },
        },
      };
    }
    try {
      const updated = await repo.updateJob(job.id, {
        collectionAt: parsed.value.collectionAt,
        calendarEventId: event.eventId,
        updatedAt: now.toISOString(),
      });
      return {
        ok: true,
        status: 200,
        body: {
          ...jobEcho(updated),
          collection_at: updated.collectionAt,
          calendar_event_id: updated.calendarEventId,
          calendar: event.action,
        },
        jobId: updated.id,
      };
    } catch {
      if (event.action === "created") {
        await runtime.calendar.deleteEvent(event.eventId).catch(() => undefined);
      }
      return {
        ok: false,
        status: 500,
        body: {
          ...jobEcho(job),
          error: { code: "internal_error", message: "The collection time could not be saved." },
        },
      };
    }
  });
}

async function commit(
  repo: JobRepository,
  operation: ActionOperation,
  clientRequestId: string,
  hash: string,
  now: Date,
  work: () => Promise<WriteOutcome>,
): Promise<Response> {
  const claim = await repo.claimIdempotency({
    clientRequestId,
    operation,
    requestHash: hash,
    createdAt: now.toISOString(),
  });
  if (claim.result === "replay") return json(claim.record.httpStatus, claim.record.response);
  if (claim.result === "conflict") {
    return fail(
      409,
      "idempotency_conflict",
      "That client_request_id was already used for a different write. Send a new id.",
    );
  }
  if (claim.result === "in_progress") {
    return fail(409, "idempotency_in_progress", "That write is already being handled.");
  }

  let outcome: WriteOutcome;
  try {
    outcome = await work();
  } catch (error) {
    await repo.releaseIdempotency(clientRequestId);
    throw error;
  }
  if (!outcome.ok) {
    await repo.releaseIdempotency(clientRequestId);
    return json(outcome.status, outcome.body);
  }
  await repo.completeIdempotency(clientRequestId, outcome.status, outcome.body);
  await repo.writeAudit({
    operation,
    clientRequestId,
    jobId: outcome.jobId,
    createdAt: now.toISOString(),
  });
  return json(outcome.status, outcome.body);
}

async function getJob(request: Request, repo: JobRepository, rawRef: string | undefined): Promise<Response> {
  const url = new URL(request.url);
  if ([...url.searchParams.keys()].length > 0) {
    return fail(400, "validation_error", "get_job does not take query fields. Pass the ref in the path.");
  }
  const ref = canonicalJobRef(rawRef ?? "");
  if (!ref) return fail(400, "validation_error", "ref must look like LL-4K7M.");
  const job = await repo.getJobByRef(ref);
  if (!job) return fail(404, "not_found", "No job with that ref.", null, ref);
  const notes = await repo.listNotes(job.id);
  const photos = await repo.listPhotoCaptions(job.id);
  return json(200, {
    ...jobEcho(job),
    job: toPublicJob(job),
    notes: notes.map(toPublicNote),
    photo_count: photos.count,
    photo_captions: photos.captions,
  });
}

async function findJobs(request: Request, repo: JobRepository): Promise<Response> {
  const url = new URL(request.url);
  const parsed = parseFindJobs(url);
  if (!parsed.ok) return fail(400, "validation_error", parsed.message);
  const matches = await repo.findJobs(parsed.value);
  return json(200, {
    filter: {
      customer_name: parsed.value.customerName ?? null,
      device: parsed.value.device ?? null,
      ref: parsed.value.ref ?? null,
      status: parsed.value.status ?? "active",
    },
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
}
