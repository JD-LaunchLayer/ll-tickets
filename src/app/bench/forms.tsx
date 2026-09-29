"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createJobAction,
  fileNoteAction,
  saveNextMoveAction,
  setStatusAction,
  addPhotoAction,
} from "@/app/bench/actions";
import { idleForm } from "@/lib/bench/form-state";
import { JOB_STATUSES, NOTE_TAGS, NOTE_TAG_LABELS, STATUS_LABELS, type JobStatus } from "@/lib/jobs/domain";
import { compressPhoto } from "@/lib/photos/compress";
import { PHOTO_MAX_BYTES } from "@/lib/photos/path";

function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="text-sm text-red-700" role="alert">
      {message}
    </p>
  );
}

export function CreateJobForm() {
  const [state, action, pending] = useActionState(createJobAction, idleForm);

  return (
    <form action={action} className="space-y-3">
      <label className="field">
        <span className="field-label">Customer name</span>
        <input name="customer_name" required maxLength={120} autoComplete="name" />
      </label>
      <label className="field">
        <span className="field-label">Device</span>
        <input name="device_label" required maxLength={160} autoComplete="off" />
      </label>
      <label className="field">
        <span className="field-label">Reported fault</span>
        <textarea name="reported_fault" required maxLength={2000} rows={4} />
      </label>
      <label className="field">
        <span className="field-label">Phone number</span>
        <input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} />
        <span className="mt-1 block text-sm text-slate-600">
          Optional. Shown only here, as a tap-to-call link. The GPT never sees it.
        </span>
      </label>
      <FieldError message={state.error} />
      <button className="tech-btn-primary" type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create job"}
      </button>
    </form>
  );
}

export function NoteForm({ jobRef, noteCount }: { jobRef: string; noteCount: number }) {
  const [state, action, pending] = useActionState(fileNoteAction, idleForm);

  return (
    <form action={action} className="segment space-y-3 p-4" key={noteCount}>
      <input type="hidden" name="ref" value={jobRef} />
      <label className="field">
        <span className="field-label">Note</span>
        <textarea name="text" required maxLength={4000} rows={4} placeholder="What did you find?" />
      </label>
      <label className="field">
        <span className="field-label">Tag</span>
        <select name="tag" defaultValue="">
          <option value="">No tag</option>
          {NOTE_TAGS.map((tag) => (
            <option key={tag} value={tag}>
              {NOTE_TAG_LABELS[tag]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field-label">Next move</span>
        <input name="next_move" maxLength={180} autoComplete="off" placeholder="Leave blank to keep it" />
      </label>
      <FieldError message={state.error} />
      <button className="tech-btn-primary" type="submit" disabled={pending}>
        {pending ? "Filing…" : "File note"}
      </button>
    </form>
  );
}

export function StatusPicker({ jobRef, status }: { jobRef: string; status: JobStatus }) {
  const [state, action, pending] = useActionState(setStatusAction, idleForm);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="ref" value={jobRef} />
      <label className="field">
        <span className="field-label">Status</span>
        <select
          name="status"
          defaultValue={status}
          key={`${status}-${state.error ?? "ok"}`}
          disabled={pending}
          onChange={(event) => {
            event.currentTarget.form?.requestSubmit();
          }}
        >
          {JOB_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <FieldError message={state.error} />
    </form>
  );
}

export function NextMoveForm({ jobRef, nextMove }: { jobRef: string; nextMove: string }) {
  const [state, action, pending] = useActionState(saveNextMoveAction, idleForm);

  return (
    <form action={action} className="space-y-2" key={nextMove}>
      <input type="hidden" name="ref" value={jobRef} />
      <label className="field">
        <span className="field-label">Next move</span>
        <input name="next_move" required maxLength={180} defaultValue={nextMove} autoComplete="off" />
      </label>
      <FieldError message={state.error} />
      <button className="tech-btn-secondary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save next move"}
      </button>
    </form>
  );
}

export function PhotoForm({ jobRef }: { jobRef: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      const blob = await compressPhoto(file);
      if (blob.size > PHOTO_MAX_BYTES) {
        setError("That photo is too large.");
        return;
      }
      const body = new FormData();
      body.set("ref", jobRef);
      body.set("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
      const result = await addPhotoAction(body);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setError("That photo could not be prepared. Try a JPEG or PNG.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className={`tech-btn-secondary ${pending ? "pointer-events-none opacity-60" : ""}`}>
        {pending ? "Adding photo…" : "Add photo"}
        <input
          className="sr-only"
          type="file"
          accept="image/*"
          disabled={pending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void onFile(file);
          }}
        />
      </label>
      <FieldError message={error} />
      <noscript>
        <p className="text-sm text-slate-600">Adding a photo needs JavaScript so location data can be removed first.</p>
      </noscript>
    </div>
  );
}
