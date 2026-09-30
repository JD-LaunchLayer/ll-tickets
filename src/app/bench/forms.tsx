"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addPhotoAction, createJobAction } from "@/app/bench/actions";
import { ErrorPanel } from "@/app/bench/error-panel";
import { useOffline } from "@/app/bench/providers";
import { SaveToast } from "@/app/bench/toast";
import { usePendingPhrase } from "@/app/bench/use-pending-phrase";
import { idleForm, JOB_FIELD_INPUT, type FormState, type JobFormField } from "@/lib/bench/form-state";
import { formatBenchTime } from "@/lib/bench/format";
import { compressPhoto } from "@/lib/photos/compress";
import { PHOTO_MAX_BYTES } from "@/lib/photos/path";
import type { SignedPhoto } from "@/lib/photos/views";

function FieldError({ message, reason }: { message: string | null; reason?: string | null }) {
  if (!message) return null;
  return <ErrorPanel message={message} reason={reason} />;
}

function describedBy(field: JobFormField, state: FormState, hintId?: string): string | undefined {
  const invalid = state.field === field;
  const errorId = invalid ? `${JOB_FIELD_INPUT[field]}-error` : undefined;
  const ids = [hintId, errorId].filter((id): id is string => Boolean(id));
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function FieldMessage({ field, state }: { field: JobFormField; state: FormState }) {
  if (state.field !== field || !state.fieldMessage) return null;
  return (
    <p id={`${JOB_FIELD_INPUT[field]}-error`} className="field-error" role="alert">
      {state.fieldMessage}
    </p>
  );
}

export function CreateJobForm({ initialState = idleForm }: { initialState?: FormState }) {
  const [state, action, pending] = useActionState(createJobAction, initialState);
  const offline = useOffline();
  const phrase = usePendingPhrase(pending, "Creating…", "Create job");
  const draft = state.draft;

  useEffect(() => {
    if (!state.field) return;
    document.getElementById(JOB_FIELD_INPUT[state.field])?.focus();
  }, [state.field, state.formKey]);

  return (
    <form action={action} className="pin-form">
      <div className="pin-form-body" key={state.formKey ?? "new"}>
        <label className="field">
          <span className="field-label">Customer name</span>
          <input
            id={JOB_FIELD_INPUT.customerName}
            name="customer_name"
            required
            maxLength={120}
            autoComplete="name"
            autoCapitalize="words"
            readOnly={pending}
            defaultValue={draft?.customerName ?? ""}
            aria-invalid={state.field === "customerName" ? true : undefined}
            aria-describedby={describedBy("customerName", state)}
          />
          <FieldMessage field="customerName" state={state} />
        </label>
        <label className="field">
          <span className="field-label">Device</span>
          <input
            id={JOB_FIELD_INPUT.deviceLabel}
            name="device_label"
            required
            maxLength={160}
            autoComplete="off"
            autoCapitalize="words"
            readOnly={pending}
            defaultValue={draft?.deviceLabel ?? ""}
            aria-invalid={state.field === "deviceLabel" ? true : undefined}
            aria-describedby={describedBy("deviceLabel", state)}
          />
          <FieldMessage field="deviceLabel" state={state} />
        </label>
        <label className="field">
          <span className="field-label">Reported fault</span>
          <textarea
            id={JOB_FIELD_INPUT.reportedFault}
            className="fault-input"
            name="reported_fault"
            required
            maxLength={2000}
            rows={3}
            autoCapitalize="sentences"
            readOnly={pending}
            defaultValue={draft?.reportedFault ?? ""}
            aria-invalid={state.field === "reportedFault" ? true : undefined}
            aria-describedby={describedBy("reportedFault", state)}
          />
          <FieldMessage field="reportedFault" state={state} />
        </label>
        <label className="field">
          <span className="field-label">Phone number</span>
          <input
            id={JOB_FIELD_INPUT.phone}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={40}
            readOnly={pending}
            defaultValue={draft?.phone ?? ""}
            aria-invalid={state.field === "phone" ? true : undefined}
            aria-describedby={describedBy("phone", state, "phone-hint")}
          />
          <span id="phone-hint" className="field-hint">
            Optional. Tap-to-call on the job. The GPT never sees it.
          </span>
          <FieldMessage field="phone" state={state} />
        </label>
      </div>
      {state.error ? (
        <div className="pin-error">
          <FieldError message={state.error} reason={state.reason} />
        </div>
      ) : null}
      <div className="action-bar">
        <button className="tech-btn-primary" type="submit" disabled={pending || offline}>
          {phrase}
        </button>
      </div>
    </form>
  );
}

export function PhotosBlock({
  jobRef,
  photos,
  photoError,
}: {
  jobRef: string;
  photos: SignedPhoto[];
  photoError: string | null;
}) {
  const router = useRouter();
  const [failure, setFailure] = useState<FormState>(idleForm);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeToken, setNoticeToken] = useState<string | undefined>(undefined);
  const phrase = usePendingPhrase(pending, "Adding photo…", "Add photo");

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
    <section className="job-list" aria-label="Photos">
      <div className="section-head">
        <h2 className="section-label">Photos</h2>
        <label className={`tech-btn-quiet ${pending ? "pointer-events-none" : ""}`}>
          {phrase}
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
      </div>
      {photoError ? (
        <p className="error-panel-message" role="alert">
          {photoError}
        </p>
      ) : null}
      {photos.length > 0 ? (
        <ul className="photo-grid">
          {photos.map((photo) => (
            <li key={photo.id}>
              <a href={photo.url}>
                {/* Signed URL for a private object. The image optimiser must not fetch it. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.caption ?? "Photo on this job"} />
                <span>{formatBenchTime(photo.takenAt)}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      <FieldError message={failure.error} reason={failure.reason} />
      <SaveToast message={notice} token={noticeToken} />
      <p className="muted fine">
        Device photos are stored privately for the repair and deleted 12 months after the job is closed.
      </p>
      <noscript>
        <p className="muted">Adding a photo needs JavaScript so location data can be removed first.</p>
      </noscript>
    </section>
  );
}
