import Link from "next/link";
import { notFound } from "next/navigation";
import { NextMoveForm, NoteForm, PhotoForm, StatusPicker } from "@/app/bench/forms";
import { BenchShell } from "@/app/bench/shell";
import { ownerContext } from "@/lib/bench/context";
import { formatBenchTime } from "@/lib/bench/format";
import { loadBenchJob } from "@/lib/bench/jobs";
import { telHref } from "@/lib/bench/phone";
import { NOTE_TAG_LABELS } from "@/lib/jobs/domain";
import { createPrivatePhotoUrl } from "@/lib/photos/signed-url";
import { signJobPhotos, type SignedPhoto } from "@/lib/photos/views";

export const dynamic = "force-dynamic";

export default async function JobPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const { repo, supabase } = await ownerContext();
  const loaded = await loadBenchJob(repo, ref);
  if (!loaded) notFound();
  const { job, notes } = loaded;
  const call = job.phone ? telHref(job.phone) : null;

  let photos: SignedPhoto[] = [];
  let photoError: string | null = null;
  try {
    const stored = await repo.listPhotos(job.id);
    if (stored.length > 0) {
      photos = await signJobPhotos(stored, (path) => createPrivatePhotoUrl(supabase, path));
    }
  } catch {
    photoError = "Photos could not be shown. Try again in a moment.";
  }

  return (
    <BenchShell title={job.ref} backHref="/" backLabel="Jobs" dock={<NoteForm jobRef={job.ref} />}>
      <header className="summary-card">
        <p className="summary-name">{job.customerName}</p>
        <p className="summary-device">{job.deviceLabel}</p>
        {job.phone && call ? (
          <a href={call} className="call-link">
            {job.phone}
          </a>
        ) : (
          <p className="muted">No phone number</p>
        )}
        <p className="section-label">Reported fault</p>
        <p className="note-text">{job.reportedFault}</p>
      </header>

      <Link href={`/jobs/${job.ref}/ask`} className="tech-btn-secondary">
        Ask the record
      </Link>

      <StatusPicker jobRef={job.ref} status={job.status} />
      <NextMoveForm jobRef={job.ref} nextMove={job.nextMove} />

      <section className="job-list">
        <h2 className="section-label">Notes</h2>
        {notes.length === 0 ? <p className="empty">No notes yet.</p> : null}
        <ul className="timeline">
          {notes.map((note) => (
            <li key={note.id} className="note-card">
              <p className="note-meta">
                <span className="status-pill">{note.tag ? NOTE_TAG_LABELS[note.tag] : "Note"}</span>
                <time dateTime={note.createdAt}>{formatBenchTime(note.createdAt)}</time>
              </p>
              <p className="note-text">{note.text}</p>
              {note.editedAt ? <p className="muted">Edited {formatBenchTime(note.editedAt)}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="job-list">
        <h2 className="section-label">Photos</h2>
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
        <PhotoForm jobRef={job.ref} />
        <p className="muted">
          Device photos are stored privately for the repair and deleted 12 months after the job is closed.
        </p>
      </section>
    </BenchShell>
  );
}
