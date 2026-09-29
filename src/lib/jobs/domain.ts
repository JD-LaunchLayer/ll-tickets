export const JOB_STATUSES = [
  "new",
  "diagnosing",
  "waiting_on_parts",
  "waiting_on_customer",
  "ready",
  "collected",
  "closed_no_repair",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const CLOSED_STATUSES = ["collected", "closed_no_repair"] as const;

export type ClosedStatus = (typeof CLOSED_STATUSES)[number];

export const PRICE_BASES = ["estimate", "quote"] as const;
export type PriceBasis = (typeof PRICE_BASES)[number];

export const BACKUP_POSITIONS = [
  "customer_backed_up",
  "we_backed_up",
  "not_needed",
  "not_discussed",
] as const;
export type BackupPosition = (typeof BACKUP_POSITIONS)[number];

export const NOTE_TAGS = [
  "finding",
  "work_done",
  "parts",
  "customer_contact",
  "quote_auth",
  "other",
] as const;
export type NoteTag = (typeof NOTE_TAGS)[number];

export const STATUS_LABELS: Record<JobStatus, string> = {
  new: "New",
  diagnosing: "Diagnosing",
  waiting_on_parts: "Waiting on parts",
  waiting_on_customer: "Waiting on customer",
  ready: "Ready",
  collected: "Collected",
  closed_no_repair: "Closed, no repair",
};

export type Job = {
  id: string;
  ref: string;
  customerName: string;
  phone: string | null;
  deviceLabel: string;
  reportedFault: string;
  status: JobStatus;
  nextMove: string;
  priceGbp: number | null;
  priceBasis: PriceBasis | null;
  priceAgreedAt: string | null;
  backupPosition: BackupPosition | null;
  accessGiven: boolean | null;
  collectionAt: string | null;
  calendarEventId: string | null;
  followUpAt: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
};

export type PublicJob = {
  ref: string;
  customer_name: string;
  device_label: string;
  reported_fault: string;
  status: JobStatus;
  next_move: string;
  price_gbp: number | null;
  price_basis: PriceBasis | null;
  price_agreed_at: string | null;
  backup_position: BackupPosition | null;
  access_given: boolean | null;
  collection_at: string | null;
  calendar_event_id: string | null;
  follow_up_at: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

export type Note = {
  id: string;
  jobId: string;
  text: string;
  summary: string;
  tag: NoteTag | null;
  amountGbp: number | null;
  partDetail: string | null;
  createdAt: string;
  editedAt: string | null;
  clientRequestId: string;
};

export type PublicNote = {
  id: string;
  text: string;
  summary: string;
  tag: NoteTag | null;
  amount_gbp: number | null;
  part_detail: string | null;
  created_at: string;
  edited_at: string | null;
};

export type NoteRevision = {
  id: string;
  noteId: string;
  text: string;
  summary: string;
  tag: NoteTag | null;
  amountGbp: number | null;
  partDetail: string | null;
  supersededAt: string;
};

export type Photo = {
  id: string;
  jobId: string;
  noteId: string | null;
  storagePath: string;
  takenAt: string;
  caption: string | null;
  createdAt: string;
};

export function isJobStatus(value: string): value is JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(value);
}

export function isClosedStatus(status: JobStatus): status is ClosedStatus {
  return status === "collected" || status === "closed_no_repair";
}

export function isActiveStatus(status: JobStatus): boolean {
  return !isClosedStatus(status);
}

/** Mirrors public.set_job_closed_at. Reopening clears closed_at. A job that stays closed keeps the original time. */
export function closedAtAfterStatusChange(
  previous: { status: JobStatus; closedAt: string | null },
  nextStatus: JobStatus,
  nowIso: string,
): string | null {
  if (!isClosedStatus(nextStatus)) return null;
  if (previous.closedAt && isClosedStatus(previous.status)) return previous.closedAt;
  return previous.closedAt ?? nowIso;
}

export function toPublicJob(job: Job): PublicJob {
  return {
    ref: job.ref,
    customer_name: job.customerName,
    device_label: job.deviceLabel,
    reported_fault: job.reportedFault,
    status: job.status,
    next_move: job.nextMove,
    price_gbp: job.priceGbp,
    price_basis: job.priceBasis,
    price_agreed_at: job.priceAgreedAt,
    backup_position: job.backupPosition,
    access_given: job.accessGiven,
    collection_at: job.collectionAt,
    calendar_event_id: job.calendarEventId,
    follow_up_at: job.followUpAt,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
    closed_at: job.closedAt,
  };
}

export function toPublicNote(note: Note): PublicNote {
  return {
    id: note.id,
    text: note.text,
    summary: note.summary,
    tag: note.tag,
    amount_gbp: note.amountGbp,
    part_detail: note.partDetail,
    created_at: note.createdAt,
    edited_at: note.editedAt,
  };
}

export function jobEcho(job: Pick<Job, "ref" | "customerName" | "deviceLabel">) {
  return {
    ref: job.ref,
    customer_name: job.customerName,
    device_label: job.deviceLabel,
  };
}

export function summaryLine(input: {
  ref: string;
  customerName: string;
  deviceLabel: string;
  status: JobStatus;
  nextMove: string;
  lastNoteSummary: string | null;
}): string {
  const last = input.lastNoteSummary ?? "No notes yet";
  return `${input.ref} · ${input.customerName} · ${input.deviceLabel} · ${STATUS_LABELS[input.status]} · ${input.nextMove} · ${last}`;
}

export function collectKeys(value: unknown, keys: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      keys.add(key);
      collectKeys(nested, keys);
    }
  }
  return keys;
}

export function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const nested of Object.values(value)) collectStrings(nested, out);
  }
  return out;
}
