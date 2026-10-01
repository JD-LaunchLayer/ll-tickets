import type { BenchListRow } from "@/lib/bench/jobs";

export const BENCH_VIEWS = ["bench", "parts", "ready"] as const;
export type BenchView = (typeof BENCH_VIEWS)[number];

export function parseBenchView(value: string | undefined): BenchView {
  if (value === "parts" || value === "ready") return value;
  return "bench";
}

/** Narrows the active list already loaded. It does not change the query. */
export function filterActiveJobs(rows: BenchListRow[], view: BenchView): BenchListRow[] {
  if (view === "parts") return rows.filter((row) => row.status === "waiting_on_parts");
  if (view === "ready") return rows.filter((row) => row.status === "ready");
  return rows;
}

export function emptyListMessage(view: BenchView): string {
  if (view === "parts") return "No jobs waiting on parts.";
  if (view === "ready") return "No jobs ready to collect.";
  return "No jobs on the bench.";
}
