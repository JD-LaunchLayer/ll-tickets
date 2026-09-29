import Link from "next/link";
import { ErrorPanel } from "@/app/bench/error-panel";
import { JobSearch } from "@/app/bench/job-search";
import { BenchShell } from "@/app/bench/shell";
import { ownerContext } from "@/lib/bench/context";
import { emptyListMessage, filterActiveJobs, parseBenchView, type BenchView } from "@/lib/bench/filters";
import { listBenchJobs, type BenchListRow } from "@/lib/bench/jobs";
import { jobListPanel } from "@/lib/bench/list-panel";
import { STATUS_LABELS } from "@/lib/jobs/domain";

export const dynamic = "force-dynamic";

function listHref(view: BenchView, finished: boolean, q: string): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (view !== "bench") params.set("view", view);
  if (finished) params.set("finished", "1");
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function JobRow({ row }: { row: BenchListRow }) {
  return (
    <li>
      <Link href={`/jobs/${row.ref}`} className="job-card">
        <div className="job-card-top">
          <span className="job-ref">{row.ref}</span>
          <span className={`status-pill status-${row.status}`}>{STATUS_LABELS[row.status]}</span>
        </div>
        <p className="job-customer">{row.customerName}</p>
        <p className="job-device">{row.deviceLabel}</p>
        <p className="job-next">{row.nextMove}</p>
      </Link>
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

  const filters: Array<{ id: BenchView; label: string }> = [
    { id: "bench", label: "On the bench" },
    { id: "parts", label: "Waiting on parts" },
    { id: "ready", label: "Ready" },
  ];

  return (
    <BenchShell title="Jobs" showSignOut>
      <JobSearch q={q} view={view} finished={includeFinished} />
      <div className="chip-row">
        {filters.map((filter) => (
          <Link
            key={filter.id}
            href={listHref(filter.id, includeFinished, q)}
            className="chip"
            aria-current={view === filter.id ? "page" : undefined}
          >
            {filter.label}
          </Link>
        ))}
        <Link
          href={listHref(view, !includeFinished, q)}
          className="chip"
          aria-pressed={includeFinished}
        >
          Include finished
        </Link>
      </div>
      <Link href="/jobs/new" className="tech-btn-primary">
        New job
      </Link>
      {panel.kind === "error" ? (
        <ErrorPanel message={panel.message} reason={panel.reason} retryHref={listHref(view, includeFinished, q)} />
      ) : null}
      {panel.kind === "empty" ? <p className="empty">{panel.message}</p> : null}
      {panel.kind === "jobs" && active.length > 0 ? (
        <ul className="job-list">
          {active.map((row) => (
            <JobRow key={row.ref} row={row} />
          ))}
        </ul>
      ) : null}
      {panel.kind === "jobs" && finished.length > 0 ? (
        <section className="job-list">
          <h2 className="section-label">Finished</h2>
          <ul className="job-list">
            {finished.map((row) => (
              <JobRow key={row.ref} row={row} />
            ))}
          </ul>
        </section>
      ) : null}
    </BenchShell>
  );
}
