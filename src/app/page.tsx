import Link from "next/link";
import { RetryLink } from "@/app/bench/retry-link";
import { BenchShell } from "@/app/bench/shell";
import { ownerContext } from "@/lib/bench/context";
import { listBenchJobs, type BenchListRow } from "@/lib/bench/jobs";
import { jobListPanel } from "@/lib/bench/list-panel";
import { STATUS_LABELS } from "@/lib/jobs/domain";

export const dynamic = "force-dynamic";

function listHref(finished: boolean, q: string): string {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (finished) params.set("finished", "1");
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

function JobRow({ row }: { row: BenchListRow }) {
  return (
    <li>
      <Link
        href={`/jobs/${row.ref}`}
        className="block min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 active:bg-slate-50"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-mono text-sm font-semibold">{row.ref}</span>
          <span className="text-sm text-slate-600">{STATUS_LABELS[row.status]}</span>
        </div>
        <p className="mt-1 text-base font-medium">{row.customerName}</p>
        <p className="text-sm text-slate-700">{row.deviceLabel}</p>
        <p className="mt-1 text-sm">{row.nextMove}</p>
      </Link>
    </li>
  );
}

function tabClass(current: boolean): string {
  return current
    ? "flex min-h-12 w-full items-center justify-center rounded-lg bg-[#3b82f6] px-3 text-center text-sm font-semibold text-white"
    : "flex min-h-12 w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-center text-sm font-semibold text-slate-800";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; finished?: string | string[] }>;
}) {
  const query = await searchParams;
  const rawQ = Array.isArray(query.q) ? query.q[0] : query.q;
  const rawFinished = Array.isArray(query.finished) ? query.finished[0] : query.finished;
  const q = rawQ ?? "";
  const includeFinished = rawFinished === "1";

  const { repo } = await ownerContext();
  let active: BenchListRow[] = [];
  let finished: BenchListRow[] = [];
  let failed = false;
  let listError: unknown = null;
  try {
    const listed = await listBenchJobs(repo, { search: q, includeFinished });
    active = listed.active;
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
  });

  return (
    <BenchShell title="Jobs" showSignOut askHref="/ask">
      <form action="/" method="get" className="space-y-3">
        {includeFinished ? <input type="hidden" name="finished" value="1" /> : null}
        <label className="field">
          <span className="field-label">Search</span>
          <input
            name="q"
            defaultValue={q}
            placeholder="Name, device or ref"
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>
        <button className="tech-btn-primary" type="submit">
          Search
        </button>
      </form>
      <div className="grid grid-cols-2 gap-2">
        <Link href={listHref(false, q)} className={tabClass(!includeFinished)} aria-current={!includeFinished ? "page" : undefined}>
          On the bench
        </Link>
        <Link href={listHref(true, q)} className={tabClass(includeFinished)} aria-current={includeFinished ? "page" : undefined}>
          Include finished
        </Link>
      </div>
      <Link href="/jobs/new" className="tech-btn-secondary">
        New job
      </Link>
      {panel.kind === "error" ? (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3" role="alert">
          <p className="text-sm font-semibold text-red-900">{panel.message}</p>
          {panel.reason ? <p className="mt-1 text-sm text-red-900">{panel.reason}</p> : null}
          <RetryLink href={listHref(includeFinished, q)} />
        </div>
      ) : null}
      {panel.kind === "empty" ? <p className="text-sm text-slate-600">{panel.message}</p> : null}
      {panel.kind === "jobs" && active.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {active.map((row) => (
            <JobRow key={row.ref} row={row} />
          ))}
        </ul>
      ) : null}
      {panel.kind === "jobs" && finished.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-slate-600">Finished</h2>
          <ul className="flex flex-col gap-2">
            {finished.map((row) => (
              <JobRow key={row.ref} row={row} />
            ))}
          </ul>
        </section>
      ) : null}
    </BenchShell>
  );
}
