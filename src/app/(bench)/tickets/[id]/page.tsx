import { BenchStatePicker } from "@/app/(bench)/tickets/[id]/bench-state-picker";
import { NoteComposer } from "@/app/(bench)/tickets/[id]/note-composer";
import { NotesTimeline } from "@/app/(bench)/tickets/[id]/notes-timeline";
import { BenchHeader } from "@/components/bench-header";
import { formatShopDateTime } from "@/lib/tickets/datetime";
import { storedBenchState } from "@/lib/tickets/status";
import { getTicketDetail } from "@/lib/tickets/queries";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ticket = await getTicketDetail(id);
  if (!ticket) notFound();

  const name = ticket.customer?.name ?? "Customer";
  const device = ticket.device?.label ?? "Device";
  const title = !device || device === "Device" ? name : `${name} · ${device}`;
  const state = storedBenchState(ticket);

  return (
    <div className="flex h-dvh flex-col">
      <div className="sticky top-0 z-20">
        <BenchHeader title={title} backHref="/tickets" />
      </div>
      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        <section className="segment space-y-2 p-3">
          <p className="text-xs text-slate-500">
            {formatShopDateTime(new Date(ticket.due_at))}
          </p>
          <p className="text-sm text-slate-800">{ticket.symptom}</p>
          {ticket.customer?.phone ? (
            <p className="text-sm text-slate-600">{ticket.customer.phone}</p>
          ) : null}
          <BenchStatePicker ticketId={ticket.id} state={state} />
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">Notes</h2>
          <NotesTimeline notes={ticket.notes} />
        </section>

        <p className="text-sm">
          <Link className="text-[#3b82f6] underline" href="/more">
            History and help
          </Link>
        </p>
      </main>
      <NoteComposer ticketId={ticket.id} />
    </div>
  );
}
