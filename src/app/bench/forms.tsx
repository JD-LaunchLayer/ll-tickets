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
import { ErrorPanel } from "@/app/bench/error-panel";
import { SaveToast } from "@/app/bench/toast";
import { idleForm, type FormState } from "@/lib/bench/form-state";
import { JOB_STATUSES, NOTE_TAGS, NOTE_TAG_LABELS, STATUS_LABELS, type JobStatus, type NoteTag } from "@/lib/jobs/domain";
import { compressPhoto } from "@/lib/photos/compress";
import { PHOTO_MAX_BYTES } from "@/lib/photos/path";

function FieldError({ message, reason }: { message: string | null; reason?: string | null }) {
  if (!message) return null;
  return <ErrorPanel message={message} reason={reason} />;
}

export function CreateJobForm() {
  const [state, action, pending] = useActionState(createJobAction, idleForm);

  return (
    <form action={action} className="panel">
      <div className="job-list">
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
          <span className="muted">Optional. Shown only here, as a tap-to-call link. The GPT never sees it.</span>
        </label>
        <FieldError message={state.error} reason={state.reason} />
        <button className="tech-btn-primary" type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create job"}
        </button>
      </div>
    </form>
  );
}

export function NoteForm({ jobRef }: { jobRef: string }) {
  const [state, action, pending] = useActionState(fileNoteAction, idleForm);
  return (
    <NoteFields
      key={state.noticeId ?? "draft"}
      jobRef={jobRef}
      action={action}
      pending={pending}
      error={state.error}
      reason={state.reason}
      notice={state.notice}
      noticeId={state.noticeId}
    />
  );
}

function NoteFields({
  jobRef,
  action,
  pending,
  error,
  reason,
  notice,
  noticeId,
}: {
  jobRef: string;
  action: (payload: FormData) => void;
  pending: boolean;
  error: string | null;
  reason: string | null;
  notice?: string | null;
  noticeId?: string;
}) {
  const [tag, setTag] = useState<NoteTag | "">("finding");

  return (
    <form action={action} className="note-dock">
      <input type="hidden" name="ref" value={jobRef} />
      <input type="hidden" name="tag" value={tag} />
      <label className="field">
        <span className="field-label">Note</span>
        <textarea name="text" required maxLength={4000} rows={3} placeholder="What did you find?" />
      </label>
      <fieldset>
        <legend className="field-label">Tag</legend>
        <div className="chip-row">
          <button
            type="button"
            className="chip"
            aria-pressed={tag === ""}
            onClick={() => setTag("")}
          >
            No tag
          </button>
          {NOTE_TAGS.map((value) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed={tag === value}
              onClick={() => setTag(value)}
            >
              {NOTE_TAG_LABELS[value]}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span className="field-label">Next move</span>
        <input name="next_move" maxLength={180} autoComplete="off" placeholder="Leave blank to keep it" />
      </label>
      <FieldError message={error} reason={reason} />
      <button className="tech-btn-primary" type="submit" disabled={pending}>
        {pending ? "Filing…" : "File note"}
      </button>
      <SaveToast message={notice} token={noticeId} />
    </form>
  );
}

export function StatusPicker({ jobRef, status }: { jobRef: string; status: JobStatus }) {
  const [state, action, pending] = useActionState(setStatusAction, idleForm);

  return (
    <form action={action} className="panel">
      <input type="hidden" name="ref" value={jobRef} />
      <p className="section-label">Status</p>
      <div className="chip-row" role="group" aria-label="Status">
        {JOB_STATUSES.map((value) => (
          <button
            key={value}
            type="submit"
            name="status"
            value={value}
            className="chip"
            aria-pressed={value === status}
            disabled={pending || value === status}
          >
            {STATUS_LABELS[value]}
          </button>
        ))}
      </div>
      <FieldError message={state.error} reason={state.reason} />
      <SaveToast message={state.notice} token={state.noticeId} />
    </form>
  );
}

export function NextMoveForm({ jobRef, nextMove }: { jobRef: string; nextMove: string }) {
  const [state, action, pending] = useActionState(saveNextMoveAction, idleForm);
  const [dirty, setDirty] = useState(false);
  const [seenNotice, setSeenNotice] = useState<string | undefined>(undefined);
  if (state.noticeId && state.noticeId !== seenNotice) {
    setSeenNotice(state.noticeId);
    setDirty(false);
  }

  const saved = Boolean(state.notice) && !dirty;

  return (
    <form action={action} className="panel">
      <input type="hidden" name="ref" value={jobRef} />
      <label className="field">
        <span className="field-label">Next move</span>
        <input
          name="next_move"
          required
          maxLength={180}
          defaultValue={nextMove}
          autoComplete="off"
          onChange={() => setDirty(true)}
        />
      </label>
      <FieldError message={state.error} reason={state.reason} />
      <button className="tech-btn-secondary" type="submit" disabled={pending || saved}>
        {pending ? "Saving…" : saved ? "Saved" : "Save"}
      </button>
      <SaveToast message={state.notice} token={state.noticeId} />
    </form>
  );
}

export function PhotoForm({ jobRef }: { jobRef: string }) {
  const router = useRouter();
  const [failure, setFailure] = useState<FormState>(idleForm);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeToken, setNoticeToken] = useState<string | undefined>(undefined);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setPending(true);
    setFailure(idleForm);
    setNotice(null);
    try {
      const blob = await compressPhoto(file);
      if (blob.size > PHOTO_MAX_BYTES) {
        setFailure({ error: "That photo is too large.", reason: null });
        return;
      }
      const body = new FormData();
      body.set("ref", jobRef);
      body.set("photo", new File([blob], "photo.jpg", { type: "image/jpeg" }));
      const result = await addPhotoAction(body);
      if (result.error) {
        setFailure(result);
        return;
      }
      setNotice("Photo added.");
      setNoticeToken(String(Date.now()));
      router.refresh();
    } catch {
      setFailure({ error: "That photo could not be prepared. Try a JPEG or PNG.", reason: null });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="job-list">
      <label className={`tech-btn-secondary ${pending ? "pointer-events-none" : ""}`}>
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
      <FieldError message={failure.error} reason={failure.reason} />
      <SaveToast message={notice} token={noticeToken} />
      <noscript>
        <p className="muted">Adding a photo needs JavaScript so location data can be removed first.</p>
      </noscript>
    </div>
  );
}
