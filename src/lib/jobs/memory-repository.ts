import { randomUUID } from "crypto";
import { phoneForStorage } from "@/lib/bench/phone";
import {
  closedAtAfterStatusChange,
  type Job,
  type Note,
  type NoteRevision,
  type Photo,
} from "@/lib/jobs/domain";
import { generateJobRef } from "@/lib/jobs/ref";
import {
  FIND_LIMIT,
  type AuditEntry,
  type FindQuery,
  type IdempotencyClaim,
  type IdempotencyRecord,
  type JobMatch,
  type JobPatch,
  type JobRepository,
  type NewJob,
  type NewNote,
  type NewPhoto,
  type NotePatch,
} from "@/lib/jobs/repository";

function includesFold(haystack: string, needle: string): boolean {
  return haystack.toLocaleLowerCase("en-GB").includes(needle.toLocaleLowerCase("en-GB"));
}

export class MemoryJobRepository implements JobRepository {
  readonly jobs: Job[] = [];
  readonly notes: Note[] = [];
  readonly revisions: NoteRevision[] = [];
  readonly photos: Photo[] = [];
  readonly idempotency = new Map<string, IdempotencyRecord>();
  readonly audits: AuditEntry[] = [];

  seedPhone(jobId: string, phone: string): void {
    const job = this.jobs.find((item) => item.id === jobId);
    if (!job) throw new Error("Job not found.");
    job.phone = phone;
  }

  async addPhoto(input: NewPhoto): Promise<Photo> {
    const photo: Photo = {
      id: input.id ?? randomUUID(),
      jobId: input.jobId,
      noteId: input.noteId ?? null,
      storagePath: input.storagePath,
      takenAt: input.takenAt,
      caption: input.caption,
      createdAt: input.takenAt,
    };
    this.photos.push(photo);
    return photo;
  }

  async createJob(input: NewJob): Promise<Job> {
    let ref = generateJobRef();
    while (this.jobs.some((job) => job.ref === ref)) ref = generateJobRef();
    const job: Job = {
      id: randomUUID(),
      ref,
      customerName: input.customerName,
      deviceLabel: input.deviceLabel,
      reportedFault: input.reportedFault,
      status: "new",
      nextMove: input.nextMove,
      priceGbp: input.priceGbp,
      priceBasis: input.priceBasis,
      priceAgreedAt: input.priceAgreedAt,
      backupPosition: input.backupPosition,
      accessGiven: input.accessGiven,
      phone: phoneForStorage(input.phone),
      collectionAt: null,
      calendarEventId: null,
      followUpAt: input.followUpAt,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      closedAt: null,
    };
    this.jobs.push(job);
    return job;
  }

  async updateJob(id: string, patch: JobPatch): Promise<Job> {
    const job = this.jobs.find((item) => item.id === id);
    if (!job) throw new Error("Job not found.");
    const nextStatus = patch.status ?? job.status;
    const closedAt =
      patch.closedAt !== undefined
        ? patch.closedAt
        : patch.status
          ? closedAtAfterStatusChange(job, nextStatus, patch.updatedAt)
          : job.closedAt;
    Object.assign(job, {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.nextMove !== undefined ? { nextMove: patch.nextMove } : {}),
      ...(patch.priceGbp !== undefined ? { priceGbp: patch.priceGbp } : {}),
      ...(patch.priceBasis !== undefined ? { priceBasis: patch.priceBasis } : {}),
      ...(patch.priceAgreedAt !== undefined ? { priceAgreedAt: patch.priceAgreedAt } : {}),
      ...(patch.backupPosition !== undefined ? { backupPosition: patch.backupPosition } : {}),
      ...(patch.accessGiven !== undefined ? { accessGiven: patch.accessGiven } : {}),
      ...(patch.followUpAt !== undefined ? { followUpAt: patch.followUpAt } : {}),
      ...(patch.collectionAt !== undefined ? { collectionAt: patch.collectionAt } : {}),
      ...(patch.calendarEventId !== undefined ? { calendarEventId: patch.calendarEventId } : {}),
      closedAt,
      updatedAt: patch.updatedAt,
    });
    return job;
  }

  async getJobByRef(ref: string): Promise<Job | null> {
    return this.jobs.find((job) => job.ref === ref.toUpperCase()) ?? null;
  }

  async findJobs(query: FindQuery): Promise<JobMatch[]> {
    const status = query.status ?? "active";
    const device = query.device?.trim() ?? "";
    const matched = this.jobs.filter((job) => {
      if (query.ref && job.ref !== query.ref) return false;
      if (status === "active") {
        if (job.status === "collected" || job.status === "closed_no_repair") return false;
      } else if (job.status !== status) return false;
      if (!device) return true;
      if (includesFold(job.deviceLabel, device) || includesFold(job.reportedFault, device)) return true;
      return this.notes.some(
        (note) =>
          note.jobId === job.id && (includesFold(note.text, device) || includesFold(note.summary, device)),
      );
    });
    matched.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return matched.slice(0, FIND_LIMIT).map((job) => ({
      job,
      lastNoteSummary: this.latestSummary(job.id),
    }));
  }

  async addNote(input: NewNote): Promise<Note> {
    const note: Note = {
      id: randomUUID(),
      jobId: input.jobId,
      text: input.text,
      summary: input.summary,
      tag: input.tag,
      amountGbp: input.amountGbp,
      partDetail: input.partDetail,
      createdAt: input.createdAt,
      editedAt: null,
      clientRequestId: input.clientRequestId,
    };
    this.notes.push(note);
    return note;
  }

  async getNote(id: string): Promise<Note | null> {
    return this.notes.find((note) => note.id === id) ?? null;
  }

  async editNote(id: string, patch: NotePatch): Promise<{ note: Note; revision: NoteRevision }> {
    const note = this.notes.find((item) => item.id === id);
    if (!note) throw new Error("Note not found.");
    const revision: NoteRevision = {
      id: randomUUID(),
      noteId: note.id,
      text: note.text,
      summary: note.summary,
      tag: note.tag,
      amountGbp: note.amountGbp,
      partDetail: note.partDetail,
      supersededAt: patch.editedAt,
    };
    this.revisions.push(revision);
    if (patch.text !== undefined) note.text = patch.text;
    if (patch.summary !== undefined) note.summary = patch.summary;
    if (patch.tag !== undefined) note.tag = patch.tag;
    if (patch.amountGbp !== undefined) note.amountGbp = patch.amountGbp;
    if (patch.partDetail !== undefined) note.partDetail = patch.partDetail;
    note.editedAt = patch.editedAt;
    return { note, revision };
  }

  async listNotes(jobId: string): Promise<Note[]> {
    return this.notes
      .filter((note) => note.jobId === jobId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  async listPhotos(jobId: string): Promise<Photo[]> {
    return this.photos
      .filter((photo) => photo.jobId === jobId)
      .sort((a, b) => (a.takenAt > b.takenAt ? 1 : -1));
  }

  async listPhotoCaptions(jobId: string): Promise<{ count: number; captions: Array<string | null> }> {
    const photos = this.photos
      .filter((photo) => photo.jobId === jobId)
      .sort((a, b) => (a.takenAt > b.takenAt ? 1 : -1));
    return { count: photos.length, captions: photos.map((photo) => photo.caption) };
  }

  async listRevisions(noteId: string): Promise<NoteRevision[]> {
    return this.revisions.filter((revision) => revision.noteId === noteId);
  }

  async claimIdempotency(input: {
    clientRequestId: string;
    operation: string;
    requestHash: string;
    createdAt: string;
  }): Promise<IdempotencyClaim> {
    const existing = this.idempotency.get(input.clientRequestId);
    if (existing) return classify(existing, input.operation, input.requestHash);
    const record: IdempotencyRecord = {
      clientRequestId: input.clientRequestId,
      operation: input.operation,
      requestHash: input.requestHash,
      response: null,
      httpStatus: 0,
      createdAt: input.createdAt,
    };
    this.idempotency.set(input.clientRequestId, record);
    return { result: "claimed" };
  }

  async completeIdempotency(
    clientRequestId: string,
    httpStatus: number,
    response: unknown,
  ): Promise<void> {
    const record = this.idempotency.get(clientRequestId);
    if (!record) throw new Error("Missing idempotency row.");
    record.httpStatus = httpStatus;
    record.response = response;
  }

  async releaseIdempotency(clientRequestId: string): Promise<void> {
    const record = this.idempotency.get(clientRequestId);
    if (record && record.response == null) this.idempotency.delete(clientRequestId);
  }

  async writeAudit(entry: AuditEntry): Promise<void> {
    this.audits.push(entry);
  }

  private latestSummary(jobId: string): string | null {
    const notes = this.notes
      .filter((note) => note.jobId === jobId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return notes[0]?.summary ?? null;
  }
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
