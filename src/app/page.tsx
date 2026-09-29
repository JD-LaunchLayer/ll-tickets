import Link from "next/link";
import { ListScrollMemory, RememberListLink } from "@/app/bench/back-button";
import { ErrorPanel } from "@/app/bench/error-panel";
import { JobSearch } from "@/app/bench/job-search";
import { BenchShell } from "@/app/bench/shell";
import { ownerContext } from "@/lib/bench/context";
import { emptyListMessage, filterActiveJobs, parseBenchView, type BenchView } from "@/lib/bench/filters";
import { listBenchJobs, type BenchListRow } from "@/lib/bench/jobs";
import { jobListPanel } from "@/lib/bench/list-panel";
import { buildListQuery, jobPath, listPath } from "@/lib/bench/list-place";
import { STATUS_LABELS } from "@/lib/jobs/domain";

export const dynamic = "force-dynamic";

const FILTERS: Array<{ id: BenchView; label: string; aria: string }> = [
  { id: "bench", label: "On bench", aria: "On the bench" },
  { id: "parts", label: "Parts", aria: "Waiting on parts" },
  { id: "ready", label: "Ready", aria: "Ready" },
];

function listHref(view: BenchView, finished: boolean, q: string): string {
  return listPath(buildListQuery(view, finished, q));
}

function JobRow({ row, from }: { row: BenchListRow; from: string }) {
  return (
    <li>
      <RememberListLink href={jobPath(row.ref, from)} className="job-card">
        <div className="job-card-top">
          <p className="job-customer">{row.customerName}</p>
          <span className={`status-pill status-${row.status}`}>{STATUS_LABELS[row.status]}</span>
        </div>
        <p className="job-device-line">
          {row.deviceLabel}
          {" · "}
          <span className="job-ref-id">{row.ref}</span>
        </p>
        <p className="job-next clamp-2">{row.nextMove}</p>
      </RememberListLink>
    </li>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; finished?: string | string[]; view?: string | string[] }>;
}) {
  const query = await searchParams;
  const rawQ = Array.isArray(query.q) ? query.q[0] : query.q;
  const rawFinished = Array.isArray(query.finished) ? query.finished[0] : query.finished;
  const rawView = Array.isArray(query.view) ? query.view[0] : query.view;
  const q = rawQ ?? "";
  const includeFinished = rawFinished === "1";
  const view = parseBenchView(rawView);
  const from = buildListQuery(view, includeFinished, q);

  const { repo } = await ownerContext();
  let active: BenchListRow[] = [];
  let finished: BenchListRow[] = [];
  let failed = false;
  let listError: unknown = null;
  try {
    const listed = await listBenchJobs(repo, { search: q, includeFinished });
    active = filterActiveJobs(listed.active, view);
    finished = listed.finished;
  } catch (error) {
    failed = true;
    listError = error;
  }

  const panel = jobListPanel({
    failed,
    error: listError,
    activeCount: active.length,
    finishedCount: finished.length,
    search: q,
    emptyMessage: emptyListMessage(view),
  });

  return (
    <BenchShell title="Jobs" titlePlacement="bar" barTitleSize="md" showSignOut>
      <ListScrollMemory />
      <JobSearch q={q} view={view} finished={includeFinished} />
      <div className="segments">
        {FILTERS.map((filter) => (
          <Link
            key={filter.id}
            href={listHref(filter.id, includeFinished, q)}
            className="segment"
            aria-label={filter.aria}
            aria-current={view === filter.id ? "true" : undefined}
          >
            {filter.label}
          </Link>
        ))}
      </div>
      {panel.kind === "error" ? (
        <ErrorPanel message={panel.message} reason={panel.reason} retryHref={listHref(view, includeFinished, q)} />
      ) : null}
      {panel.kind === "empty" ? (
        <div className="job-list">
          <p className="empty">{panel.message}</p>
          {view === "bench" ? (
            <div className="empty-actions">
              <Link href="/jobs/new" className="tech-btn-quiet">
                New job
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
      {panel.kind === "jobs" && active.length > 0 ? (
        <ul className="job-list">
          {active.map((row) => (
            <JobRow key={row.ref} row={row} from={from} />
          ))}
        </ul>
      ) : null}
      {panel.kind === "jobs" && finished.length > 0 ? (
        <section className="job-list" aria-label="Finished">
          <h2 className="section-label">Finished</h2>
          <ul className="job-list">
            {finished.map((row) => (
              <JobRow key={row.ref} row={row} from={from} />
            ))}
          </ul>
        </section>
      ) : null}
      <div className="finished-toggle">
        <Link href={listHref(view, !includeFinished, q)} className="tech-btn-quiet">
          {includeFinished ? "Hide finished jobs" : "Show finished jobs"}
        </Link>
      </div>
    </BenchShell>
  );
}
