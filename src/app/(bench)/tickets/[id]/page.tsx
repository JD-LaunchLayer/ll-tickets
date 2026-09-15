import { BenchStatePicker } from "@/app/(bench)/tickets/[id]/bench-state-picker";
import { NoteComposer } from "@/app/(bench)/tickets/[id]/note-composer";
import { NotesTimeline } from "@/app/(bench)/tickets/[id]/notes-timeline";
import { BenchHeader } from "@/components/bench-header";
import { ticketWhoDevice } from "@/lib/tickets/labels";
import { storedBenchState } from "@/lib/tickets/status";
import { getTicketDetail } from "@/lib/tickets/queries";
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

  const state = storedBenchState(ticket);

  return (
    <div className="flex h-dvh flex-col">
      <div className="sticky top-0 z-20">
        <BenchHeader title={ticketWhoDevice(ticket)} backHref="/tickets" more={false} />
      </div>
      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
        <div className="space-y-1">
          <p className="text-sm text-slate-700">{ticket.symptom}</p>
          {ticket.customer?.phone ? (
            <p className="text-sm text-slate-600">{ticket.customer.phone}</p>
          ) : null}
          {ticket.next_move ? (
            <p className="text-sm text-slate-600">
              <span className="text-slate-400">next</span>
              {" · "}
              {ticket.next_move}
            </p>
          ) : null}
        </div>
        <BenchStatePicker ticketId={ticket.id} state={state} />
        <NotesTimeline notes={ticket.notes} />
      </main>
      <NoteComposer ticketId={ticket.id} />
    </div>
  );
}
