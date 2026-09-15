import Link from "next/link";
import { formatShopDateTime, formatShopTime, isSameShopDay } from "@/lib/tickets/datetime";
import { ARRIVAL_LABELS, STATUS_LABELS } from "@/lib/tickets/labels";
import type { TicketListItem } from "@/lib/tickets/types";

export function TicketRow({ ticket }: { ticket: TicketListItem }) {
  const due = new Date(ticket.due_at);
  const when = isSameShopDay(due, new Date())
    ? formatShopTime(due)
    : formatShopDateTime(due);
  const name = ticket.customer?.name ?? "Customer";
  const device = ticket.device?.label ?? "Device";

  return (
    <Link
      href={`/tickets/${ticket.id}`}
      className="block rounded-lg border border-slate-200 bg-white px-3 py-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-semibold text-slate-900">
          {name} · {device}
        </p>
        <p className="shrink-0 text-xs text-slate-500">{when}</p>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-slate-700">{ticket.symptom}</p>
      <p className="mt-1 text-xs text-slate-500">
        {STATUS_LABELS[ticket.status]}
        {ticket.waiting ? " · waiting" : ""}
        {" · "}
        {ARRIVAL_LABELS[ticket.arrival_kind]}
      </p>
    </Link>
  );
}
