"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ownerContext } from "@/lib/bench/context";
import { idleForm, type FormState } from "@/lib/bench/form-state";
import { createBenchJob, saveBenchNextMove, setBenchStatus } from "@/lib/bench/jobs";
import { addBenchNote } from "@/lib/bench/notes";
import { JOB_PHOTOS_BUCKET } from "@/lib/photos/signed-url";
import { isJpeg, jobPhotoPath, PHOTO_MAX_BYTES } from "@/lib/photos/path";
import { canonicalJobRef } from "@/lib/jobs/ref";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function createJobAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { repo } = await ownerContext();
  const result = await createBenchJob(repo, {
    customerName: field(formData, "customer_name"),
    deviceLabel: field(formData, "device_label"),
    reportedFault: field(formData, "reported_fault"),
    phone: field(formData, "phone"),
    now: new Date(),
  });
  if (!result.ok) return { error: result.message };
  redirect(`/jobs/${result.value.ref}`);
}

export async function fileNoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { repo } = await ownerContext();
  const tag = field(formData, "tag").trim();
  const result = await addBenchNote(repo, {
    ref: field(formData, "ref"),
    text: field(formData, "text"),
    tag: tag || null,
    nextMove: field(formData, "next_move"),
    clientRequestId: `bench-${randomUUID()}`,
    now: new Date(),
  });
  if (!result.ok) return { error: result.message };
  revalidatePath("/");
  revalidatePath(`/jobs/${result.value.job.ref}`);
  return idleForm;
}

export async function setStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { repo } = await ownerContext();
  const result = await setBenchStatus(repo, field(formData, "ref"), field(formData, "status"), new Date());
  if (!result.ok) return { error: result.message };
  revalidatePath("/");
  revalidatePath(`/jobs/${result.value.ref}`);
  return idleForm;
}

export async function saveNextMoveAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { repo } = await ownerContext();
  const result = await saveBenchNextMove(
    repo,
    field(formData, "ref"),
    field(formData, "next_move"),
    new Date(),
  );
  if (!result.ok) return { error: result.message };
  revalidatePath("/");
  revalidatePath(`/jobs/${result.value.ref}`);
  return idleForm;
}

export async function addPhotoAction(formData: FormData): Promise<FormState> {
  const { repo, supabase } = await ownerContext();
  const ref = canonicalJobRef(field(formData, "ref"));
  if (!ref) return { error: "That job ref is not valid." };
  const job = await repo.getJobByRef(ref);
  if (!job) return { error: "No job with that ref." };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo." };
  if (file.size > PHOTO_MAX_BYTES) return { error: "That photo is too large." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isJpeg(bytes)) return { error: "That photo could not be stored. Add it again from the phone." };

  const photoId = randomUUID();
  const path = jobPhotoPath(job.id, photoId);
  const { error: uploadError } = await supabase.storage.from(JOB_PHOTOS_BUCKET).upload(path, bytes, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (uploadError) return { error: "Could not store the photo." };

  try {
    await repo.addPhoto({
      id: photoId,
      jobId: job.id,
      storagePath: path,
      takenAt: new Date().toISOString(),
      caption: null,
    });
  } catch {
    await supabase.storage.from(JOB_PHOTOS_BUCKET).remove([path]);
    return { error: "Could not store the photo." };
  }

  revalidatePath(`/jobs/${ref}`);
  return idleForm;
}
