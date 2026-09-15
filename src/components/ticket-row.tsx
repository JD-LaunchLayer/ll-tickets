import Link from "next/link";
import { formatShopDateTime, formatShopTime, isSameShopDay } from "@/lib/tickets/datetime";
import { BENCH_STATE_LABELS } from "@/lib/tickets/labels";
import { listBenchState } from "@/lib/tickets/status";
import type { TicketListItem } from "@/lib/tickets/types";

export function TicketRow({ ticket }: { ticket: TicketListItem }) {
  const due = new Date(ticket.due_at);
  const when = isSameShopDay(due, new Date())
    ? formatShopTime(due)
    : formatShopDateTime(due);
  const name = ticket.customer?.name ?? "Customer";
  const device = ticket.device?.label ?? "Device";
  const title = !device || device === "Device" ? name : `${name} · ${device}`;
  const state = listBenchState(ticket);

  return (
    <Link
      href={`/tickets/${ticket.id}`}
      className="block rounded-lg border border-slate-200 bg-white px-3 py-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-semibold text-slate-900">
          {title}
        </p>
        <p className="shrink-0 text-xs text-slate-500">{when}</p>
      </div>
      <p className="mt-1 line-clamp-2 text-sm text-slate-700">{ticket.symptom}</p>
      <p className="mt-1 text-xs text-slate-500">{BENCH_STATE_LABELS[state]}</p>
    </Link>
  );
}
