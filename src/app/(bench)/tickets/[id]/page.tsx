import { NoteComposer } from "@/app/(bench)/tickets/[id]/note-composer";
import { NotesTimeline } from "@/app/(bench)/tickets/[id]/notes-timeline";
import { BenchHeader } from "@/components/bench-header";
import { formatShopDateTime } from "@/lib/tickets/datetime";
import { getDoNext } from "@/lib/tickets/do-next";
import { ARRIVAL_LABELS, STATUS_LABELS } from "@/lib/tickets/labels";
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

  const check = getDoNext(ticket);
  const name = ticket.customer?.name ?? "Customer";
  const device = ticket.device?.label ?? "Device";

  return (
    <>
      <div className="sticky top-0 z-20">
        <BenchHeader title={`${name} · ${device}`} backHref="/tickets" />
      </div>
      <main className="flex flex-1 flex-col gap-3 px-4 py-3">
        <section className="segment p-3">
          <p className="text-xs text-slate-500">
            {STATUS_LABELS[ticket.status]}
            {ticket.waiting ? " · waiting" : ""}
            {" · "}
            {ARRIVAL_LABELS[ticket.arrival_kind]}
            {" · "}
            {formatShopDateTime(new Date(ticket.due_at))}
          </p>
          <p className="mt-1 text-sm text-slate-800">{ticket.symptom}</p>
          {ticket.customer?.phone ? (
            <p className="mt-1 text-sm text-slate-600">{ticket.customer.phone}</p>
          ) : null}
        </section>

        <NoteComposer ticketId={ticket.id} status={ticket.status} check={check} />

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">Notes and findings</h2>
          <NotesTimeline notes={ticket.notes} />
        </section>

        <details className="segment p-3 text-sm text-slate-700">
          <summary className="cursor-pointer font-medium">More on this ticket</summary>
          <p className="mt-2 text-slate-600">
            Jot first. Quiet statuses only: intake → diagnose → parts → done. Diagnose,
            Parts, and Done chips are optional — they never block a note. History lives
            in the timeline above. Help is on the More page.
          </p>
          <p className="mt-2">
            <Link className="text-[#3b82f6] underline" href="/more">
              History and help
            </Link>
          </p>
        </details>
      </main>
    </>
  );
}
