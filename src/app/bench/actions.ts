"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { noteFiledNotice, type NoteStatusMove } from "@/lib/bench/auto-status";
import { ownerContext } from "@/lib/bench/context";
import { idleForm, retainJobForm, type FormState, type JobDraft } from "@/lib/bench/form-state";
import { createBenchJob, saveBenchNextMove, setBenchStatus } from "@/lib/bench/jobs";
import { addBenchNote } from "@/lib/bench/notes";
import { reasonLine } from "@/lib/bench/reason";
import { JOB_PHOTOS_BUCKET } from "@/lib/photos/signed-url";
import { isJpeg, jobPhotoPath, PHOTO_MAX_BYTES } from "@/lib/photos/path";
import type { JobStatus } from "@/lib/jobs/domain";
import { canonicalJobRef } from "@/lib/jobs/ref";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function rejected(message: string, error?: unknown): FormState {
  return { error: message, reason: error === undefined ? null : reasonLine(error) };
}

function fromBench(result: { message: string; reason?: string }): FormState {
  return { error: result.message, reason: result.reason ?? null };
}

function saved(message: string): FormState {
  return { error: null, reason: null, notice: message, noticeId: randomUUID() };
}

function filedNotice(
  value: { job: { ref: string }; statusMove: NoteStatusMove | null },
  quietLine: string,
): FormState {
  const notice = noteFiledNotice(value.statusMove, quietLine);
  return {
    error: null,
    reason: null,
    notice: notice.notice,
    noticeId: randomUUID(),
    undoStatus: notice.undoStatus,
    undoRef: notice.undoStatus ? value.job.ref : null,
  };
}

export async function createJobAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const draft: JobDraft = {
    customerName: field(formData, "customer_name"),
    deviceLabel: field(formData, "device_label"),
    reportedFault: field(formData, "reported_fault"),
    phone: field(formData, "phone"),
  };
  const { repo } = await ownerContext();
  const result = await createBenchJob(repo, {
    customerName: draft.customerName,
    deviceLabel: draft.deviceLabel,
    reportedFault: draft.reportedFault,
    phone: draft.phone,
    now: new Date(),
  });
  if (!result.ok) return retainJobForm(draft, result, randomUUID());
  redirect(`/jobs/${result.value.ref}`);
}

export async function fileNoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { repo } = await ownerContext();
  const tag = field(formData, "tag").trim();
  const result = await addBenchNote(repo, {
    ref: field(formData, "ref"),
    text: field(formData, "text"),
    tag: tag || null,
    nextMove: null,
    clientRequestId: `bench-${randomUUID()}`,
    now: new Date(),
  });
  if (!result.ok) return fromBench(result);
  revalidatePath("/");
  revalidatePath(`/jobs/${result.value.job.ref}`);
  return filedNotice(result.value, "Note filed.");
}

export async function setStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { repo } = await ownerContext();
  const result = await setBenchStatus(repo, field(formData, "ref"), field(formData, "status"), new Date());
  if (!result.ok) return fromBench(result);
  revalidatePath("/");
  revalidatePath(`/jobs/${result.value.ref}`);
  return saved("Status saved.");
}

export async function saveNextMoveAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { repo } = await ownerContext();
  const result = await saveBenchNextMove(
    repo,
    field(formData, "ref"),
    field(formData, "next_move"),
    new Date(),
  );
  if (!result.ok) return fromBench(result);
  revalidatePath("/");
  revalidatePath(`/jobs/${result.value.ref}`);
  return saved("Next move saved.");
}

/** Thin wrapper: archive is a status change to collected or closed, nothing else. */
export async function archiveJobAction(input: {
  ref: string;
  status: string;
}): Promise<{ ok: true; previous: JobStatus } | { ok: false; message: string; reason: string | null }> {
  if (input.status !== "collected" && input.status !== "closed_no_repair") {
    return { ok: false, message: "Archive can only mark a job collected or closed.", reason: null };
  }
  const { repo } = await ownerContext();
  const ref = canonicalJobRef(input.ref);
  if (!ref) return { ok: false, message: "That job ref is not valid.", reason: null };
  let previous: JobStatus;
  try {
    const job = await repo.getJobByRef(ref);
    if (!job) return { ok: false, message: "No job with that ref.", reason: null };
    previous = job.status;
  } catch (error) {
    return { ok: false, message: "Could not update the status.", reason: reasonLine(error) };
  }
  const result = await setBenchStatus(repo, ref, input.status, new Date());
  if (!result.ok) return { ok: false, message: result.message, reason: result.reason ?? null };
  revalidatePath("/");
  revalidatePath(`/jobs/${result.value.ref}`);
  return { ok: true, previous };
}

export async function addPhotoAction(formData: FormData): Promise<FormState> {
  const { repo, supabase } = await ownerContext();
  const ref = canonicalJobRef(field(formData, "ref"));
  if (!ref) return rejected("That job ref is not valid.");
  let job;
  try {
    job = await repo.getJobByRef(ref);
  } catch (error) {
    return rejected("Could not store the photo.", error);
  }
  if (!job) return rejected("No job with that ref.");

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return rejected("Choose a photo.");
  if (file.size > PHOTO_MAX_BYTES) return rejected("That photo is too large.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isJpeg(bytes)) return rejected("That photo could not be stored. Add it again from the phone.");

  const photoId = randomUUID();
  const path = jobPhotoPath(job.id, photoId);
  const { error: uploadError } = await supabase.storage.from(JOB_PHOTOS_BUCKET).upload(path, bytes, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (uploadError) return rejected("Could not store the photo.", uploadError);

  try {
    await repo.addPhoto({
      id: photoId,
      jobId: job.id,
      storagePath: path,
      takenAt: new Date().toISOString(),
      caption: null,
    });
  } catch (error) {
    await supabase.storage.from(JOB_PHOTOS_BUCKET).remove([path]);
    return rejected("Could not store the photo.", error);
  }

  revalidatePath(`/jobs/${ref}`);
  return idleForm;
}
