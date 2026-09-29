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
    <BenchShell title={job.ref} backHref="/" askHref={`/jobs/${job.ref}/ask`}>
      <header className="segment px-4 py-3">
        <p className="text-lg font-semibold">{job.customerName}</p>
        <p className="text-base text-slate-800">{job.deviceLabel}</p>
        {job.phone && call ? (
          <a href={call} className="mt-2 inline-flex min-h-12 items-center text-lg font-semibold text-[#2563eb] underline">
            {job.phone}
          </a>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No phone number</p>
        )}
        <p className="mt-2 text-sm font-semibold text-slate-600">Reported fault</p>
        <p className="whitespace-pre-wrap text-sm text-slate-800">{job.reportedFault}</p>
      </header>

      <NoteForm jobRef={job.ref} noteCount={notes.length} />
      <StatusPicker jobRef={job.ref} status={job.status} />
      <NextMoveForm jobRef={job.ref} nextMove={job.nextMove} />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-slate-600">Notes</h2>
        {notes.length === 0 ? <p className="text-sm text-slate-600">No notes yet.</p> : null}
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li key={note.id} className="segment px-4 py-3">
              <p className="text-sm font-semibold text-slate-700">
                {note.tag ? NOTE_TAG_LABELS[note.tag] : "Note"}
                <span className="font-normal text-slate-500"> · {formatBenchTime(note.createdAt)}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-base">{note.text}</p>
              {note.editedAt ? (
                <p className="mt-1 text-sm text-slate-500">Edited {formatBenchTime(note.editedAt)}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-slate-600">Photos</h2>
        {photoError ? (
          <p className="text-sm text-red-700" role="alert">
            {photoError}
          </p>
        ) : null}
        {photos.length > 0 ? (
          <ul className="grid grid-cols-2 gap-2">
            {photos.map((photo) => (
              <li key={photo.id}>
                <a href={photo.url} className="block overflow-hidden rounded-lg border border-slate-200 bg-white">
                  {/* Signed URL for a private object. The image optimiser must not fetch it. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.caption ?? "Photo on this job"}
                    className="aspect-square w-full object-cover"
                  />
                  <span className="block px-2 py-1 text-xs text-slate-600">{formatBenchTime(photo.takenAt)}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <PhotoForm jobRef={job.ref} />
        <p className="text-sm text-slate-600">
          Device photos are stored privately for the repair and deleted 12 months after the job is closed.
        </p>
      </section>
    </BenchShell>
  );
}
