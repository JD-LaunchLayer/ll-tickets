/** "Filing…" while the action runs, then "Filing… still working" after a second. */
export function pendingPhrase(pending: boolean, slow: boolean, active: string, idle: string): string {
  if (!pending) return idle;
  return slow ? `${active} still working` : active;
}
