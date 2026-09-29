import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerCard } from "@/app/bench/customer-card";
import { PhotosBlock } from "@/app/bench/forms";
import { JobActionBar } from "@/app/bench/job-action-bar";
import { NoteList } from "@/app/bench/note-list";
import { BenchShell } from "@/app/bench/shell";
import { WhereAt } from "@/app/bench/where-at";
import { ownerContext } from "@/lib/bench/context";
import { formatBenchTime } from "@/lib/bench/format";
import { latestNote } from "@/lib/bench/latest-note";
import { jobPath, listPath, orderedJobRefs, parseFromQuery, placeAriaLabel, placeInList, placeLabel } from "@/lib/bench/list-place";
import { filterActiveJobs } from "@/lib/bench/filters";
import { listBenchJobs, loadBenchJob } from "@/lib/bench/jobs";
import { telHref } from "@/lib/bench/phone";
import { createPrivatePhotoUrl } from "@/lib/photos/signed-url";
import { signJobPhotos, type SignedPhoto } from "@/lib/photos/views";

export const dynamic = "force-dynamic";

export default async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { ref } = await params;
  const query = await searchParams;
  const rawFrom = Array.isArray(query.from) ? query.from[0] : query.from;
  const from = parseFromQuery(rawFrom);
  const { repo, supabase } = await ownerContext();
  const loaded = await loadBenchJob(repo, ref);
  if (!loaded) notFound();
  const { job, notes } = loaded;
  const call = job.phone ? telHref(job.phone) : null;
  const latest = latestNote(notes);

  let place = null;
  try {
    const listed = await listBenchJobs(repo, { search: from.q, includeFinished: from.finished });
    const active = filterActiveJobs(listed.active, from.view);
    place = placeInList(orderedJobRefs(active, listed.finished), job.ref);
  } catch {
    place = null;
  }

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
    <BenchShell
      chrome="bar"
      title={job.ref}
      titlePlacement="bar"
      backHref={listPath(from.raw)}
      barMeta={place ? placeLabel(place) : null}
      barMetaLabel={place ? placeAriaLabel(place) : undefined}
      actionBar={
        <JobActionBar
          key={job.ref}
          jobRef={job.ref}
          nextMove={job.nextMove}
          previousHref={place?.previousRef ? jobPath(place.previousRef, from.raw) : null}
          nextHref={place?.nextRef ? jobPath(place.nextRef, from.raw) : null}
        />
      }
    >
      <WhereAt
        key={job.ref}
        jobRef={job.ref}
        status={job.status}
        nextMove={job.nextMove}
        latestKind={latest.kind}
        latestText={latest.kind === "empty" ? "No notes yet." : latest.note.text}
        latestTime={latest.kind === "empty" ? null : formatBenchTime(latest.note.createdAt)}
        latestNoteId={latest.kind === "empty" ? null : latest.note.id}
      />
      <CustomerCard
        key={job.ref}
        name={job.customerName}
        device={job.deviceLabel}
        phone={job.phone}
        call={call}
        fault={job.reportedFault}
        startOpen={notes.length === 0}
      />
      <section className="job-list" aria-label="Notes">
        <div className="section-head">
          <h2 className="notes-heading">Notes</h2>
          <Link href={`/jobs/${job.ref}/ask`} className="tech-btn-quiet" aria-label={`Ask the record about ${job.ref}`}>
            Ask the record ›
          </Link>
        </div>
        <NoteList
          key={job.ref}
          jobRef={job.ref}
          notes={notes.map((note) => ({
            id: note.id,
            text: note.text,
            tag: note.tag,
            createdAt: note.createdAt,
            editedAt: note.editedAt,
          }))}
        />
      </section>
      <PhotosBlock jobRef={job.ref} photos={photos} photoError={photoError} />
    </BenchShell>
  );
}
