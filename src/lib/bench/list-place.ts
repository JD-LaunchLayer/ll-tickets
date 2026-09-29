import { parseBenchView, type BenchView } from "@/lib/bench/filters";

export type ListPlace = {
  /** 1-based position in the list Jordan last saw. */
  index: number;
  total: number;
  previousRef: string | null;
  nextRef: string | null;
};

export type ListQuery = {
  q: string;
  view: BenchView;
  finished: boolean;
  /** Original `from` value, kept so Back can rebuild the list URL. */
  raw: string;
};

/** Active rows first, then finished, in the order the list already returned. */
export function orderedJobRefs(
  active: readonly { ref: string }[],
  finished: readonly { ref: string }[],
): string[] {
  return [...active, ...finished].map((row) => row.ref);
}

/**
 * Neighbours follow the list order. A job that has left that filter
 * has no place, so Previous and Next stay disabled.
 */
export function placeInList(refs: readonly string[], ref: string): ListPlace | null {
  const index = refs.indexOf(ref);
  if (index < 0) return null;
  return {
    index: index + 1,
    total: refs.length,
    previousRef: index > 0 ? refs[index - 1] : null,
    nextRef: index < refs.length - 1 ? refs[index + 1] : null,
  };
}

export function placeLabel(place: ListPlace): string {
  return `${place.index} of ${place.total}`;
}

export function placeAriaLabel(place: ListPlace): string {
  return `Job ${place.index} of ${place.total}`;
}

/** The list query carried on `?from=`. Missing means the default bench list. */
export function parseFromQuery(from: string | undefined): ListQuery {
  const raw = from ?? "";
  const params = new URLSearchParams(raw);
  return {
    q: params.get("q") ?? "",
    view: parseBenchView(params.get("view") ?? undefined),
    finished: params.get("finished") === "1",
    raw,
  };
}

/** Same keys the Jobs list already puts in the URL, without a leading `?`. */
export function buildListQuery(view: BenchView, finished: boolean, q: string): string {
  const params = new URLSearchParams();
  const needle = q.trim();
  if (needle) params.set("q", needle);
  if (view !== "bench") params.set("view", view);
  if (finished) params.set("finished", "1");
  return params.toString();
}

export function listPath(query: string): string {
  return query ? `/?${query}` : "/";
}

/** Job detail URL that remembers the list query for neighbours and Back. */
export function jobPath(ref: string, from: string): string {
  const params = new URLSearchParams();
  params.set("from", from);
  return `/jobs/${ref}?${params.toString()}`;
}
