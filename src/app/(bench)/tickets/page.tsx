import { BenchHeader } from "@/components/bench-header";
import { ListTabs } from "@/components/list-tabs";
import { TicketRow } from "@/components/ticket-row";
import { LIST_VIEW_LABELS } from "@/lib/tickets/labels";
import { listTickets } from "@/lib/tickets/queries";
import { isListView, type ListView } from "@/lib/tickets/types";

export const dynamic = "force-dynamic";

const EMPTY: Record<ListView, string> = {
  open: "No open tickets.",
  waiting: "Nothing waiting.",
  done: "No done tickets yet.",
};

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const view: ListView = isListView(params.view) ? params.view : "open";
  const tickets = await listTickets(view);

  return (
    <>
      <BenchHeader newTicket />
      <main className="flex flex-1 flex-col gap-3 px-4 py-3">
        <ListTabs view={view} />
        <h1 className="sr-only">{LIST_VIEW_LABELS[view]} tickets</h1>
        {tickets.length === 0 ? (
          <p className="segment px-3 py-4 text-sm text-slate-600">{EMPTY[view]}</p>
        ) : (
          <ul className="space-y-2">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <TicketRow ticket={ticket} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
