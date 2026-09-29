export type BenchTab = "jobs" | "new" | "ask";

/** Which bottom tab is current. Job pages stay on Jobs. A job chat stays on Ask. */
export function tabCurrent(pathname: string, tab: BenchTab): boolean {
  if (tab === "new") return pathname === "/jobs/new";
  if (tab === "ask") return pathname === "/ask" || pathname.endsWith("/ask");
  if (pathname === "/jobs/new" || pathname.endsWith("/ask")) return false;
  return pathname === "/" || pathname.startsWith("/jobs/");
}
