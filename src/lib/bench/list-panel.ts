import { reasonLine } from "@/lib/bench/reason";

export type JobListPanel =
  | { kind: "error"; message: string; reason: string | null }
  | { kind: "empty"; message: string }
  | { kind: "jobs" };

/**
 * A failed list is an error, even when no rows came back.
 * The empty copy is only for a query that succeeded with nothing to show.
 */
export function jobListPanel(input: {
  failed: boolean;
  error: unknown;
  activeCount: number;
  finishedCount: number;
  search: string;
  emptyMessage?: string;
}): JobListPanel {
  if (input.failed) {
    return {
      kind: "error",
      message: "Could not load jobs.",
      reason: reasonLine(input.error),
    };
  }
  if (input.activeCount === 0 && input.finishedCount === 0) {
    return {
      kind: "empty",
      message: input.search.trim()
        ? "Nothing matches that search."
        : (input.emptyMessage ?? "No jobs on the bench."),
    };
  }
  return { kind: "jobs" };
}
