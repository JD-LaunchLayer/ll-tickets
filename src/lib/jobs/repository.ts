import type {
  BackupPosition,
  Job,
  JobStatus,
  Note,
  NoteRevision,
  NoteTag,
  PriceBasis,
} from "@/lib/jobs/domain";

export type NewJob = {
  customerName: string;
  deviceLabel: string;
  reportedFault: string;
  nextMove: string;
  priceGbp: number | null;
  priceBasis: PriceBasis | null;
  priceAgreedAt: string | null;
  backupPosition: BackupPosition | null;
  accessGiven: boolean | null;
  followUpAt: string | null;
  createdAt: string;
};

export type JobPatch = {
  status?: JobStatus;
  nextMove?: string;
  priceGbp?: number | null;
  priceBasis?: PriceBasis | null;
  priceAgreedAt?: string | null;
  backupPosition?: BackupPosition | null;
  accessGiven?: boolean | null;
  followUpAt?: string | null;
  collectionAt?: string | null;
  calendarEventId?: string | null;
  closedAt?: string | null;
  updatedAt: string;
};

export type NewNote = {
  jobId: string;
  text: string;
  summary: string;
  tag: NoteTag | null;
  amountGbp: number | null;
  partDetail: string | null;
  createdAt: string;
  clientRequestId: string;
};

export type NotePatch = {
  text?: string;
  summary?: string;
  tag?: NoteTag | null;
  amountGbp?: number | null;
  partDetail?: string | null;
  editedAt: string;
};

export type FindQuery = {
  customerName?: string;
  device?: string;
  ref?: string;
  status?: JobStatus | "active";
};

export type JobMatch = {
  job: Job;
  lastNoteSummary: string | null;
};

export type IdempotencyRecord = {
  clientRequestId: string;
  operation: string;
  requestHash: string;
  response: unknown | null;
  httpStatus: number;
  createdAt: string;
};

export type IdempotencyClaim =
  | { result: "claimed" }
  | { result: "replay"; record: IdempotencyRecord }
  | { result: "conflict"; record: IdempotencyRecord }
  | { result: "in_progress" };

export type AuditEntry = {
  operation: string;
  clientRequestId: string;
  jobId: string | null;
  createdAt: string;
};

export interface JobRepository {
  createJob(input: NewJob): Promise<Job>;
  updateJob(id: string, patch: JobPatch): Promise<Job>;
  getJobByRef(ref: string): Promise<Job | null>;
  findJobs(query: FindQuery): Promise<JobMatch[]>;
  addNote(input: NewNote): Promise<Note>;
  getNote(id: string): Promise<Note | null>;
  editNote(id: string, patch: NotePatch): Promise<{ note: Note; revision: NoteRevision }>;
  listNotes(jobId: string): Promise<Note[]>;
  listPhotoCaptions(jobId: string): Promise<{ count: number; captions: Array<string | null> }>;
  listRevisions(noteId: string): Promise<NoteRevision[]>;
  claimIdempotency(input: {
    clientRequestId: string;
    operation: string;
    requestHash: string;
    createdAt: string;
  }): Promise<IdempotencyClaim>;
  completeIdempotency(clientRequestId: string, httpStatus: number, response: unknown): Promise<void>;
  releaseIdempotency(clientRequestId: string): Promise<void>;
  writeAudit(entry: AuditEntry): Promise<void>;
}
