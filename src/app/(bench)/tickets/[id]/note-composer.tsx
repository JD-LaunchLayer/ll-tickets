"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { addTicketNote, markTicketStatus } from "@/app/(bench)/tickets/actions";
import { markAsLabel, markableStatuses } from "@/lib/tickets/status";
import type { TicketStatus } from "@/lib/tickets/types";

function PrimarySubmit({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="tech-btn-primary">
      {children}
    </button>
  );
}

function QuietChip({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800"
    >
      {children}
    </button>
  );
}

export function NoteComposer({
  ticketId,
  status,
}: {
  ticketId: string;
  status: TicketStatus;
}) {
  const marks = markableStatuses(status);

  return (
    <>
      <section className="segment sticky top-[3.25rem] z-10 space-y-3 bg-white p-3 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Jot a note</h2>
        <NoteForm ticketId={ticketId} />
      </section>
      {marks.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Optional status">
          {marks.map((mark) => (
            <form key={mark} action={markTicketStatus}>
              <input type="hidden" name="ticket_id" value={ticketId} />
              <input type="hidden" name="status" value={mark} />
              <QuietChip>{markAsLabel(mark)}</QuietChip>
            </form>
          ))}
        </div>
      ) : null}
    </>
  );
}

function NoteForm({ ticketId }: { ticketId: string }) {
  return (
    <form className="space-y-2" action={addTicketNote}>
      <input type="hidden" name="ticket_id" value={ticketId} />
      <div className="flex gap-1 rounded-lg border border-slate-200 p-1">
        <label className="flex-1 text-center text-sm">
          <input
            type="radio"
            name="kind"
            value="note"
            defaultChecked
            className="peer sr-only"
          />
          <span className="block rounded-lg px-2 py-2 peer-checked:bg-slate-100 peer-checked:font-medium">
            Note
          </span>
        </label>
        <label className="flex-1 text-center text-sm">
          <input type="radio" name="kind" value="finding" className="peer sr-only" />
          <span className="block rounded-lg px-2 py-2 peer-checked:bg-slate-100 peer-checked:font-medium">
            Finding
          </span>
        </label>
      </div>
      <textarea
        name="body"
        required
        rows={3}
        className="min-h-[5.5rem] w-full rounded-lg border border-slate-200 px-3 py-3 text-base"
        placeholder="What’s happening on this job…"
        aria-label="Note or finding"
      />
      <PrimarySubmit>Save note</PrimarySubmit>
    </form>
  );
}
