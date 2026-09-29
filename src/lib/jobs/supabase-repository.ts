import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/database.types";
import {
  closedAtAfterStatusChange,
  isActiveStatus,
  type Job,
  type Note,
  type NoteRevision,
  type Photo,
} from "@/lib/jobs/domain";
import { generateJobRef } from "@/lib/jobs/ref";
import type {
  AuditEntry,
  FindQuery,
  IdempotencyClaim,
  IdempotencyRecord,
  JobMatch,
  JobPatch,
  JobRepository,
  NewJob,
  NewNote,
  NewPhoto,
  NotePatch,
} from "@/lib/jobs/repository";

const FIND_LIMIT = 50;

type Client = SupabaseClient<Database>;
type JobRow = Database["public"]["Tables"]["jobs"]["Row"];
type NoteRow = Database["public"]["Tables"]["notes"]["Row"];
type RevisionRow = Database["public"]["Tables"]["note_revisions"]["Row"];
type IdempotencyRow = Database["public"]["Tables"]["action_idempotency"]["Row"];
type PhotoRow = Database["public"]["Tables"]["photos"]["Row"];

export class RepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryError";
  }
}

function asMoney(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function rowToJob(row: JobRow): Job {
  return {
    id: row.id,
    ref: row.ref,
    customerName: row.customer_name,
    phone: row.phone,
    deviceLabel: row.device_label,
    reportedFault: row.reported_fault,
    status: row.status,
    nextMove: row.next_move,
    priceGbp: asMoney(row.price_gbp),
    priceBasis: row.price_basis,
    priceAgreedAt: row.price_agreed_at,
    backupPosition: row.backup_position,
    accessGiven: row.access_given,
    collectionAt: row.collection_at,
    calendarEventId: row.calendar_event_id,
    followUpAt: row.follow_up_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedAt: row.closed_at,
  };
}

function rowToNote(row: NoteRow): Note {
  return {
    id: row.id,
    jobId: row.job_id,
    text: row.text,
    summary: row.summary,
    tag: row.tag,
    amountGbp: asMoney(row.amount_gbp),
    partDetail: row.part_detail,
    createdAt: row.created_at,
    editedAt: row.edited_at,
    clientRequestId: row.client_request_id,
  };
}

function rowToRevision(row: RevisionRow): NoteRevision {
  return {
    id: row.id,
    noteId: row.note_id,
    text: row.text,
    summary: row.summary,
    tag: row.tag,
    amountGbp: asMoney(row.amount_gbp),
    partDetail: row.part_detail,
    supersededAt: row.superseded_at,
  };
}

function rowToPhoto(row: PhotoRow): Photo {
  return {
    id: row.id,
    jobId: row.job_id,
    noteId: row.note_id,
    storagePath: row.storage_path,
    takenAt: row.taken_at,
    caption: row.caption,
    createdAt: row.created_at,
  };
}

function rowToIdempotency(row: IdempotencyRow): IdempotencyRecord {
  return {
    clientRequestId: row.client_request_id,
    operation: row.operation,
    requestHash: row.request_hash,
    response: row.response,
    httpStatus: row.http_status,
    createdAt: row.created_at,
  };
}

function classify(
  existing: IdempotencyRecord,
  operation: string,
  requestHash: string,
): IdempotencyClaim {
  if (existing.response == null || existing.httpStatus === 0) return { result: "in_progress" };
  if (existing.operation !== operation || existing.requestHash !== requestHash) {
    return { result: "conflict", record: existing };
  }
  return { result: "replay", record: existing };
}

function searchNeedle(value: string): string {
  return value.replace(/[%_\\]/g, "").trim();
}

export class SupabaseJobRepository implements JobRepository {
  constructor(private readonly client: Client) {}

  async createJob(input: NewJob): Promise<Job> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data, error } = await this.client
        .from("jobs")
        .insert({
          ref: generateJobRef(),
          customer_name: input.customerName,
          device_label: input.deviceLabel,
          reported_fault: input.reportedFault,
          status: "new",
          next_move: input.nextMove,
          price_gbp: input.priceGbp,
          price_basis: input.priceBasis,
          price_agreed_at: input.priceAgreedAt,
          backup_position: input.backupPosition,
          access_given: input.accessGiven,
          phone: input.phone?.trim() || null,
          follow_up_at: input.followUpAt,
          created_at: input.createdAt,
          updated_at: input.createdAt,
          closed_at: null,
        })
        .select("*")
        .single();
      if (!error && data) return rowToJob(data);
      if (error?.code !== "23505") throw new RepositoryError("Could not create the job.");
    }
    throw new RepositoryError("Could not allocate a job ref.");
  }

  async updateJob(id: string, patch: JobPatch): Promise<Job> {
    const current = await this.requireJob(id);
    const nextStatus = patch.status ?? current.status;
    const closedAt =
      patch.closedAt !== undefined
        ? patch.closedAt
        : patch.status
          ? closedAtAfterStatusChange(current, nextStatus, patch.updatedAt)
          : current.closedAt;
    const { data, error } = await this.client
      .from("jobs")
      .update({
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.nextMove !== undefined ? { next_move: patch.nextMove } : {}),
        ...(patch.priceGbp !== undefined ? { price_gbp: patch.priceGbp } : {}),
        ...(patch.priceBasis !== undefined ? { price_basis: patch.priceBasis } : {}),
        ...(patch.priceAgreedAt !== undefined ? { price_agreed_at: patch.priceAgreedAt } : {}),
        ...(patch.backupPosition !== undefined ? { backup_position: patch.backupPosition } : {}),
        ...(patch.accessGiven !== undefined ? { access_given: patch.accessGiven } : {}),
        ...(patch.followUpAt !== undefined ? { follow_up_at: patch.followUpAt } : {}),
        ...(patch.collectionAt !== undefined ? { collection_at: patch.collectionAt } : {}),
        ...(patch.calendarEventId !== undefined
          ? { calendar_event_id: patch.calendarEventId }
          : {}),
        closed_at: closedAt,
        updated_at: patch.updatedAt,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) throw new RepositoryError("Could not update the job.");
    return rowToJob(data);
  }

  async getJobByRef(ref: string): Promise<Job | null> {
    const { data, error } = await this.client
      .from("jobs")
      .select("*")
      .eq("ref", ref.toUpperCase())
      .maybeSingle();
    if (error) throw new RepositoryError("Could not read the job.");
    return data ? rowToJob(data) : null;
  }

  async findJobs(query: FindQuery): Promise<JobMatch[]> {
    let request = this.client.from("jobs").select("*");
    if (query.ref) request = request.eq("ref", query.ref);
    const customer = query.customerName ? searchNeedle(query.customerName) : "";
    const device = query.device ? searchNeedle(query.device) : "";
    if (customer) request = request.ilike("customer_name", `%${customer}%`);
    if (device) request = request.ilike("device_label", `%${device}%`);
    const status = query.status ?? "active";
    if (status === "active") {
      request = request.not("status", "in", "(collected,closed_no_repair)");
    } else {
      request = request.eq("status", status);
    }
    const { data, error } = await request.order("updated_at", { ascending: false }).limit(FIND_LIMIT);
    if (error) throw new RepositoryError("Could not search jobs.");
    const jobs = (data ?? []).map(rowToJob).filter((job) =>
      status === "active" ? isActiveStatus(job.status) : job.status === status,
    );
    if (jobs.length === 0) return [];
    const { data: notes, error: notesError } = await this.client
      .from("notes")
      .select("job_id, summary, created_at")
      .in(
        "job_id",
        jobs.map((job) => job.id),
      )
      .order("created_at", { ascending: false });
    if (notesError) throw new RepositoryError("Could not read note summaries.");
    const summaries = new Map<string, string>();
    for (const note of notes ?? []) {
      if (!summaries.has(note.job_id)) summaries.set(note.job_id, note.summary);
    }
    return jobs.map((job) => ({ job, lastNoteSummary: summaries.get(job.id) ?? null }));
  }

  async addNote(input: NewNote): Promise<Note> {
    const { data, error } = await this.client
      .from("notes")
      .insert({
        job_id: input.jobId,
        text: input.text,
        summary: input.summary,
        tag: input.tag,
        amount_gbp: input.amountGbp,
        part_detail: input.partDetail,
        created_at: input.createdAt,
        client_request_id: input.clientRequestId,
      })
      .select("*")
      .single();
    if (error || !data) throw new RepositoryError("Could not file the note.");
    return rowToNote(data);
  }

  async getNote(id: string): Promise<Note | null> {
    const { data, error } = await this.client.from("notes").select("*").eq("id", id).maybeSingle();
    if (error) throw new RepositoryError("Could not read the note.");
    return data ? rowToNote(data) : null;
  }

  async editNote(id: string, patch: NotePatch): Promise<{ note: Note; revision: NoteRevision }> {
    const { data, error } = await this.client
      .from("notes")
      .update({
        ...(patch.text !== undefined ? { text: patch.text } : {}),
        ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
        ...(patch.tag !== undefined ? { tag: patch.tag } : {}),
        ...(patch.amountGbp !== undefined ? { amount_gbp: patch.amountGbp } : {}),
        ...(patch.partDetail !== undefined ? { part_detail: patch.partDetail } : {}),
        edited_at: patch.editedAt,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) throw new RepositoryError("Could not edit the note.");
    const { data: revisions, error: revisionError } = await this.client
      .from("note_revisions")
      .select("*")
      .eq("note_id", id)
      .order("superseded_at", { ascending: false })
      .limit(1);
    if (revisionError) throw new RepositoryError("Could not read the note revision.");
    const revisionRow = revisions?.[0];
    if (!revisionRow) throw new RepositoryError("The previous note text was not kept.");
    return { note: rowToNote(data), revision: rowToRevision(revisionRow) };
  }

  async listNotes(jobId: string): Promise<Note[]> {
    const { data, error } = await this.client
      .from("notes")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });
    if (error) throw new RepositoryError("Could not read notes.");
    return (data ?? []).map(rowToNote);
  }

  async listPhotos(jobId: string): Promise<Photo[]> {
    const { data, error } = await this.client
      .from("photos")
      .select("*")
      .eq("job_id", jobId)
      .order("taken_at", { ascending: true });
    if (error) throw new RepositoryError("Could not read photos.");
    return (data ?? []).map(rowToPhoto);
  }

  async addPhoto(input: NewPhoto): Promise<Photo> {
    const { data, error } = await this.client
      .from("photos")
      .insert({
        ...(input.id ? { id: input.id } : {}),
        job_id: input.jobId,
        note_id: input.noteId ?? null,
        storage_path: input.storagePath,
        taken_at: input.takenAt,
        caption: input.caption,
      })
      .select("*")
      .single();
    if (error || !data) throw new RepositoryError("Could not store the photo.");
    return rowToPhoto(data);
  }

  async listPhotoCaptions(jobId: string): Promise<{ count: number; captions: Array<string | null> }> {
    const { data, error } = await this.client
      .from("photos")
      .select("caption, taken_at")
      .eq("job_id", jobId)
      .order("taken_at", { ascending: true });
    if (error) throw new RepositoryError("Could not read photo captions.");
    const captions = (data ?? []).map((photo) => photo.caption);
    return { count: captions.length, captions };
  }

  async listRevisions(noteId: string): Promise<NoteRevision[]> {
    const { data, error } = await this.client
      .from("note_revisions")
      .select("*")
      .eq("note_id", noteId)
      .order("superseded_at", { ascending: true });
    if (error) throw new RepositoryError("Could not read note revisions.");
    return (data ?? []).map(rowToRevision);
  }

  async claimIdempotency(input: {
    clientRequestId: string;
    operation: string;
    requestHash: string;
    createdAt: string;
  }): Promise<IdempotencyClaim> {
    const { error } = await this.client.from("action_idempotency").insert({
      client_request_id: input.clientRequestId,
      operation: input.operation,
      request_hash: input.requestHash,
      response: null,
      http_status: 0,
      created_at: input.createdAt,
    });
    if (!error) return { result: "claimed" };
    if (error.code !== "23505") throw new RepositoryError("Could not store the request id.");
    const existing = await this.readIdempotency(input.clientRequestId);
    if (!existing) return { result: "in_progress" };
    return classify(existing, input.operation, input.requestHash);
  }

  async completeIdempotency(
    clientRequestId: string,
    httpStatus: number,
    response: unknown,
  ): Promise<void> {
    const { error } = await this.client
      .from("action_idempotency")
      .update({ http_status: httpStatus, response: response as Json })
      .eq("client_request_id", clientRequestId);
    if (error) throw new RepositoryError("Could not store the action result.");
  }

  async releaseIdempotency(clientRequestId: string): Promise<void> {
    await this.client
      .from("action_idempotency")
      .delete()
      .eq("client_request_id", clientRequestId)
      .eq("http_status", 0);
  }

  async writeAudit(entry: AuditEntry): Promise<void> {
    const { error } = await this.client.from("action_audit").insert({
      operation: entry.operation,
      client_request_id: entry.clientRequestId,
      job_id: entry.jobId,
      created_at: entry.createdAt,
    });
    if (error) throw new RepositoryError("Could not write the audit trail.");
  }

  private async requireJob(id: string): Promise<Job> {
    const { data, error } = await this.client.from("jobs").select("*").eq("id", id).maybeSingle();
    if (error || !data) throw new RepositoryError("Could not read the job.");
    return rowToJob(data);
  }

  private async readIdempotency(clientRequestId: string): Promise<IdempotencyRecord | null> {
    const { data, error } = await this.client
      .from("action_idempotency")
      .select("*")
      .eq("client_request_id", clientRequestId)
      .maybeSingle();
    if (error) throw new RepositoryError("Could not read the request id.");
    return data ? rowToIdempotency(data) : null;
  }
}
