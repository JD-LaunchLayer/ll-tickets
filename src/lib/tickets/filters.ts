import { isFutureShopDay, isSameShopDay } from "./datetime";
import type { ListView, TicketListItem } from "./types";

export function matchesListView(
  ticket: Pick<TicketListItem, "status" | "waiting" | "due_at">,
  view: ListView,
  now = new Date(),
): boolean {
  const due = new Date(ticket.due_at);
  const done = ticket.status === "done";

  switch (view) {
    case "today":
      return !done && isSameShopDay(due, now);
    case "active":
      return !done && !ticket.waiting && !isFutureShopDay(due, now);
    case "waiting":
      return !done && (ticket.waiting || isFutureShopDay(due, now));
    case "done":
      return done;
    default:
      return false;
  }
}

export function sortTickets(
  tickets: TicketListItem[],
  view: ListView,
): TicketListItem[] {
  const copy = [...tickets];
  copy.sort((a, b) => {
    if (view === "done") {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    }
    const due = new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    if (due !== 0) return due;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  return copy;
}

export function filterTickets(
  tickets: TicketListItem[],
  view: ListView,
  now = new Date(),
): TicketListItem[] {
  return sortTickets(
    tickets.filter((ticket) => matchesListView(ticket, view, now)),
    view,
  );
}
