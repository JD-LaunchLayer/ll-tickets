import { createHash } from "crypto";
import {
  BACKUP_POSITIONS,
  JOB_STATUSES,
  NOTE_TAGS,
  type BackupPosition,
  type JobStatus,
  type NoteTag,
  type PriceBasis,
  PRICE_BASES,
} from "@/lib/jobs/domain";
import { canonicalJobRef } from "@/lib/jobs/ref";
import { resolvePrice, type ResolvedPrice } from "@/lib/jobs/price";

export type ParseFail = { ok: false; message: string };
export type ParseOk<T> = { ok: true; value: T };

const CLIENT_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BANNED_KEY = /(phone|mobile|password|passwd)/i;

export type CreateJobInput = {
  clientRequestId: string;
  customerName: string;
  deviceLabel: string;
  reportedFault: string;
  nextMove: string;
  price: ResolvedPrice;
  backupPosition: BackupPosition | null;
  accessGiven: boolean | null;
  followUpAt: string | null;
};

export type AddNoteInput = {
  clientRequestId: string;
  ref: string;
  text: string;
  summary: string;
  tag: NoteTag | null;
  amountGbp: number | null;
  partDetail: string | null;
  nextMove?: string;
};

export type EditNoteInput = {
  clientRequestId: string;
  ref: string;
  noteId: string;
  text?: string;
  summary?: string;
  tag?: NoteTag | null;
  amountGbp?: number | null;
  partDetail?: string | null;
};

export type SetStatusInput = {
  clientRequestId: string;
  ref: string;
  status: JobStatus;
  nextMove?: string;
  price: ResolvedPrice | "unchanged";
  backupPosition?: BackupPosition | null;
  accessGiven?: boolean | null;
  followUpAt?: string | null;
};

export type CollectionInput = {
  clientRequestId: string;
  ref: string;
  collectionAt: string;
};

export type FindJobsInput = {
  customerName?: string;
  device?: string;
  ref?: string;
  status?: JobStatus | "active";
};

export function requestHash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export async function readJsonObject(
  request: Request,
): Promise<ParseOk<Record<string, unknown>> | ParseFail> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false, message: "Send a JSON body with content type application/json." };
  }
  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return { ok: false, message: "The body is not valid JSON." };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, message: "The body must be a JSON object." };
  }
  const body = parsed as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (BANNED_KEY.test(key)) {
      return {
        ok: false,
        message: "The Action API never accepts a phone number or a password.",
      };
    }
  }
  return { ok: true, value: body };
}

function unknownField(body: Record<string, unknown>, allowed: readonly string[]): string | null {
  const unexpected = Object.keys(body).filter((key) => !allowed.includes(key));
  if (unexpected.length === 0) return null;
  return `Unknown field: ${unexpected[0]}.`;
}

function requireId(body: Record<string, unknown>): ParseOk<string> | ParseFail {
  const value = body.client_request_id;
  if (typeof value !== "string" || !CLIENT_REQUEST_ID.test(value)) {
    return {
      ok: false,
      message:
        "client_request_id must be 8 to 200 characters: letters, numbers, and . _ : -",
    };
  }
  return { ok: true, value };
}

function requireRef(value: unknown): ParseOk<string> | ParseFail {
  if (typeof value !== "string") return { ok: false, message: "ref is required." };
  const ref = canonicalJobRef(value);
  if (!ref) return { ok: false, message: "ref must look like LL-4K7M." };
  return { ok: true, value: ref };
}

function oneLine(value: unknown, field: string, max: number): ParseOk<string> | ParseFail {
  if (typeof value !== "string") return { ok: false, message: `${field} is required.` };
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, message: `${field} is required.` };
  if (trimmed.length > max) return { ok: false, message: `${field} must be ${max} characters or fewer.` };
  if (/[\r\n]/.test(trimmed)) return { ok: false, message: `${field} must be a single line.` };
  return { ok: true, value: trimmed };
}

function requiredText(value: unknown, field: string, max: number): ParseOk<string> | ParseFail {
  if (typeof value !== "string") return { ok: false, message: `${field} is required.` };
  const trimmed = value.trim();
  if (!trimmed) return { ok: false, message: `${field} is required.` };
  if (trimmed.length > max) return { ok: false, message: `${field} must be ${max} characters or fewer.` };
  return { ok: true, value: trimmed };
}

function optionalOneLine(
  body: Record<string, unknown>,
  field: string,
  max: number,
): ParseOk<string | undefined> | ParseFail {
  if (!(field in body)) return { ok: true, value: undefined };
  return oneLine(body[field], field, max);
}

function parseGbp(value: unknown, field: string): ParseOk<number> | ParseFail {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, message: `${field} must be a number of pounds.` };
  }
  if (value < 0) return { ok: false, message: `${field} cannot be negative.` };
  if (value > 100000) return { ok: false, message: `${field} is unexpectedly large.` };
  const pence = Math.round(value * 100);
  if (Math.abs(value * 100 - pence) > 1e-6) {
    return { ok: false, message: `${field} must have at most two decimal places.` };
  }
  return { ok: true, value: pence / 100 };
}

function parseTimestamp(value: unknown, field: string): ParseOk<string> | ParseFail {
  if (typeof value !== "string") return { ok: false, message: `${field} must be an ISO datetime.` };
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value.trim())) {
    return { ok: false, message: `${field} must include a timezone offset, for example +01:00 or Z.` };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { ok: false, message: `${field} is not a valid datetime.` };
  return { ok: true, value: date.toISOString() };
}

function parseOptionalTimestamp(
  body: Record<string, unknown>,
  field: string,
): ParseOk<{ present: boolean; value: string | null }> | ParseFail {
  if (!(field in body)) return { ok: true, value: { present: false, value: null } };
  if (body[field] === null) return { ok: true, value: { present: true, value: null } };
  const parsed = parseTimestamp(body[field], field);
  if (!parsed.ok) return parsed;
  return { ok: true, value: { present: true, value: parsed.value } };
}

function parseEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): ParseOk<T> | ParseFail {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    return { ok: false, message: `${field} must be one of: ${allowed.join(", ")}.` };
  }
  return { ok: true, value: value as T };
}

function parsePriceFields(
  body: Record<string, unknown>,
  now: Date,
  mode: "create" | "patch",
): ParseOk<ResolvedPrice | "unchanged"> | ParseFail {
  const priceGbpPresent = "price_gbp" in body;
  const priceBasisPresent = "price_basis" in body;
  const priceAgreedAtPresent = "price_agreed_at" in body;

  let priceGbp: number | null = null;
  if (priceGbpPresent) {
    if (body.price_gbp === null) {
      priceGbp = null;
    } else {
      const parsed = parseGbp(body.price_gbp, "price_gbp");
      if (!parsed.ok) return parsed;
      priceGbp = parsed.value;
    }
  }

  let priceBasis: PriceBasis | null = null;
  if (priceBasisPresent) {
    if (body.price_basis === null) {
      priceBasis = null;
    } else {
      const parsed = parseEnum(body.price_basis, "price_basis", PRICE_BASES);
      if (!parsed.ok) return parsed;
      priceBasis = parsed.value;
    }
  }

  const agreed = parseOptionalTimestamp(body, "price_agreed_at");
  if (!agreed.ok) return agreed;

  const resolved = resolvePrice({
    priceGbp,
    priceBasis,
    priceAgreedAt: agreed.value.value,
    priceGbpPresent,
    priceBasisPresent,
    priceAgreedAtPresent,
    now,
    mode,
  });
  if (!resolved.ok) return resolved;
  return { ok: true, value: resolved.price };
}

function parseBackup(
  body: Record<string, unknown>,
): ParseOk<BackupPosition | null | undefined> | ParseFail {
  if (!("backup_position" in body)) return { ok: true, value: undefined };
  if (body.backup_position === null) return { ok: true, value: null };
  return parseEnum(body.backup_position, "backup_position", BACKUP_POSITIONS);
}

function parseAccess(body: Record<string, unknown>): ParseOk<boolean | null | undefined> | ParseFail {
  if (!("access_given" in body)) return { ok: true, value: undefined };
  if (body.access_given === null) return { ok: true, value: null };
  if (typeof body.access_given !== "boolean") {
    return { ok: false, message: "access_given must be true or false. Never send a password." };
  }
  return { ok: true, value: body.access_given };
}

function parseTag(body: Record<string, unknown>, required: boolean): ParseOk<NoteTag | null | undefined> | ParseFail {
  if (!("tag" in body)) {
    return required
      ? { ok: true, value: null }
      : { ok: true, value: undefined };
  }
  if (body.tag === null) return { ok: true, value: null };
  return parseEnum(body.tag, "tag", NOTE_TAGS);
}

export function parseCreateJob(
  body: Record<string, unknown>,
  now: Date,
): ParseOk<CreateJobInput> | ParseFail {
  const unknown = unknownField(body, [
    "client_request_id",
    "customer_name",
    "device_label",
    "reported_fault",
    "next_move",
    "price_gbp",
    "price_basis",
    "price_agreed_at",
    "backup_position",
    "access_given",
    "follow_up_at",
  ]);
  if (unknown) return { ok: false, message: unknown };

  const clientRequestId = requireId(body);
  if (!clientRequestId.ok) return clientRequestId;
  const customerName = requiredText(body.customer_name, "customer_name", 120);
  if (!customerName.ok) return customerName;
  const deviceLabel = requiredText(body.device_label, "device_label", 160);
  if (!deviceLabel.ok) return deviceLabel;
  const reportedFault = requiredText(body.reported_fault, "reported_fault", 2000);
  if (!reportedFault.ok) return reportedFault;
  const nextMove = oneLine(body.next_move, "next_move", 180);
  if (!nextMove.ok) return nextMove;
  const price = parsePriceFields(body, now, "create");
  if (!price.ok) return price;
  if (price.value === "unchanged") {
    return { ok: false, message: "Price could not be read." };
  }
  const backup = parseBackup(body);
  if (!backup.ok) return backup;
  const access = parseAccess(body);
  if (!access.ok) return access;
  const followUp = parseOptionalTimestamp(body, "follow_up_at");
  if (!followUp.ok) return followUp;

  return {
    ok: true,
    value: {
      clientRequestId: clientRequestId.value,
      customerName: customerName.value,
      deviceLabel: deviceLabel.value,
      reportedFault: reportedFault.value,
      nextMove: nextMove.value,
      price: price.value,
      backupPosition: backup.value ?? null,
      accessGiven: access.value ?? null,
      followUpAt: followUp.value.value,
    },
  };
}

export function parseAddNote(body: Record<string, unknown>): ParseOk<AddNoteInput> | ParseFail {
  const unknown = unknownField(body, [
    "client_request_id",
    "ref",
    "text",
    "summary",
    "tag",
    "amount_gbp",
    "part_detail",
    "next_move",
  ]);
  if (unknown) return { ok: false, message: unknown };
  const clientRequestId = requireId(body);
  if (!clientRequestId.ok) return clientRequestId;
  const ref = requireRef(body.ref);
  if (!ref.ok) return ref;
  const text = requiredText(body.text, "text", 4000);
  if (!text.ok) return text;
  const summary = oneLine(body.summary, "summary", 120);
  if (!summary.ok) return summary;
  const tag = parseTag(body, true);
  if (!tag.ok) return tag;

  let amountGbp: number | null = null;
  if ("amount_gbp" in body && body.amount_gbp !== null) {
    const amount = parseGbp(body.amount_gbp, "amount_gbp");
    if (!amount.ok) return amount;
    amountGbp = amount.value;
  }

  let partDetail: string | null = null;
  if ("part_detail" in body && body.part_detail !== null) {
    const part = requiredText(body.part_detail, "part_detail", 500);
    if (!part.ok) return part;
    partDetail = part.value;
  }

  const nextMove = optionalOneLine(body, "next_move", 180);
  if (!nextMove.ok) return nextMove;

  return {
    ok: true,
    value: {
      clientRequestId: clientRequestId.value,
      ref: ref.value,
      text: text.value,
      summary: summary.value,
      tag: tag.value ?? null,
      amountGbp,
      partDetail,
      ...(nextMove.value ? { nextMove: nextMove.value } : {}),
    },
  };
}

export function parseEditNote(body: Record<string, unknown>): ParseOk<EditNoteInput> | ParseFail {
  const unknown = unknownField(body, [
    "client_request_id",
    "ref",
    "note_id",
    "text",
    "summary",
    "tag",
    "amount_gbp",
    "part_detail",
  ]);
  if (unknown) return { ok: false, message: unknown };
  const clientRequestId = requireId(body);
  if (!clientRequestId.ok) return clientRequestId;
  const ref = requireRef(body.ref);
  if (!ref.ok) return ref;
  if (typeof body.note_id !== "string" || !UUID.test(body.note_id)) {
    return { ok: false, message: "note_id must be the note's id." };
  }

  const value: EditNoteInput = {
    clientRequestId: clientRequestId.value,
    ref: ref.value,
    noteId: body.note_id.toLowerCase(),
  };

  if ("text" in body) {
    const text = requiredText(body.text, "text", 4000);
    if (!text.ok) return text;
    value.text = text.value;
  }
  if ("summary" in body) {
    const summary = oneLine(body.summary, "summary", 120);
    if (!summary.ok) return summary;
    value.summary = summary.value;
  }
  if ("tag" in body) {
    const tag = parseTag(body, false);
    if (!tag.ok) return tag;
    value.tag = tag.value ?? null;
  }
  if ("amount_gbp" in body) {
    if (body.amount_gbp === null) {
      value.amountGbp = null;
    } else {
      const amount = parseGbp(body.amount_gbp, "amount_gbp");
      if (!amount.ok) return amount;
      value.amountGbp = amount.value;
    }
  }
  if ("part_detail" in body) {
    if (body.part_detail === null) {
      value.partDetail = null;
    } else {
      const part = requiredText(body.part_detail, "part_detail", 500);
      if (!part.ok) return part;
      value.partDetail = part.value;
    }
  }

  const changes = ["text", "summary", "tag", "amount_gbp", "part_detail"].some((key) => key in body);
  if (!changes) return { ok: false, message: "Send the field you want to change." };

  return { ok: true, value };
}

export function parseSetStatus(
  body: Record<string, unknown>,
  now: Date,
): ParseOk<SetStatusInput> | ParseFail {
  const unknown = unknownField(body, [
    "client_request_id",
    "ref",
    "status",
    "next_move",
    "price_gbp",
    "price_basis",
    "price_agreed_at",
    "backup_position",
    "access_given",
    "follow_up_at",
  ]);
  if (unknown) return { ok: false, message: unknown };
  const clientRequestId = requireId(body);
  if (!clientRequestId.ok) return clientRequestId;
  const ref = requireRef(body.ref);
  if (!ref.ok) return ref;
  if (typeof body.status !== "string") return { ok: false, message: "status is required." };
  const status = parseEnum(body.status, "status", JOB_STATUSES);
  if (!status.ok) return status;
  const nextMove = optionalOneLine(body, "next_move", 180);
  if (!nextMove.ok) return nextMove;
  const price = parsePriceFields(body, now, "patch");
  if (!price.ok) return price;
  const backup = parseBackup(body);
  if (!backup.ok) return backup;
  const access = parseAccess(body);
  if (!access.ok) return access;
  const followUp = parseOptionalTimestamp(body, "follow_up_at");
  if (!followUp.ok) return followUp;

  return {
    ok: true,
    value: {
      clientRequestId: clientRequestId.value,
      ref: ref.value,
      status: status.value,
      ...(nextMove.value ? { nextMove: nextMove.value } : {}),
      price: price.value,
      ...(backup.value !== undefined ? { backupPosition: backup.value } : {}),
      ...(access.value !== undefined ? { accessGiven: access.value } : {}),
      ...(followUp.value.present ? { followUpAt: followUp.value.value } : {}),
    },
  };
}

export function parseCollection(body: Record<string, unknown>): ParseOk<CollectionInput> | ParseFail {
  const unknown = unknownField(body, ["client_request_id", "ref", "collection_at"]);
  if (unknown) return { ok: false, message: unknown };
  const clientRequestId = requireId(body);
  if (!clientRequestId.ok) return clientRequestId;
  const ref = requireRef(body.ref);
  if (!ref.ok) return ref;
  const collectionAt = parseTimestamp(body.collection_at, "collection_at");
  if (!collectionAt.ok) return collectionAt;
  return {
    ok: true,
    value: {
      clientRequestId: clientRequestId.value,
      ref: ref.value,
      collectionAt: collectionAt.value,
    },
  };
}

export function parseFindJobs(url: URL): ParseOk<FindJobsInput> | ParseFail {
  const allowed = new Set(["customer_name", "device", "ref", "status"]);
  for (const key of url.searchParams.keys()) {
    if (!allowed.has(key)) return { ok: false, message: `Unknown query field: ${key}.` };
  }
  const value: FindJobsInput = {};
  const customer = url.searchParams.get("customer_name")?.trim();
  const device = url.searchParams.get("device")?.trim();
  const ref = url.searchParams.get("ref")?.trim();
  const status = url.searchParams.get("status")?.trim();
  if (customer) value.customerName = customer;
  if (device) value.device = device;
  if (ref) {
    const canonical = canonicalJobRef(ref);
    if (!canonical) return { ok: false, message: "ref must look like LL-4K7M." };
    value.ref = canonical;
  }
  if (status) {
    if (status === "active") value.status = "active";
    else if ((JOB_STATUSES as readonly string[]).includes(status)) value.status = status as JobStatus;
    else return { ok: false, message: `status must be active or one of: ${JOB_STATUSES.join(", ")}.` };
  }
  return { ok: true, value };
}
