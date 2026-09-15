import Link from "next/link";
import { BENCH_STATE_LABELS, ticketWhoDevice } from "@/lib/tickets/labels";
import { listBenchState } from "@/lib/tickets/status";
import type { TicketListItem } from "@/lib/tickets/types";

export function TicketRow({ ticket }: { ticket: TicketListItem }) {
  const state = listBenchState(ticket);
  const finding = ticket.latest_finding ?? ticket.symptom;

  return (
    <Link
      href={`/tickets/${ticket.id}`}
      className="block rounded-lg border border-slate-200 bg-white px-3 py-2.5"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-semibold text-slate-900">
          {ticketWhoDevice(ticket)}
        </p>
        <p className="shrink-0 text-xs text-slate-500">
          {BENCH_STATE_LABELS[state]}
        </p>
      </div>
      <p className="mt-0.5 truncate text-sm text-slate-700">{finding}</p>
      {ticket.next_move ? (
        <p className="mt-0.5 truncate text-xs text-slate-500">
          <span className="text-slate-400">next</span>
          {" · "}
          {ticket.next_move}
        </p>
      ) : null}
    </Link>
  );
}
