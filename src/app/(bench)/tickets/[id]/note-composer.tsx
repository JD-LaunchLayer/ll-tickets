"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  addTicketNote,
  applyDoNextOutcome,
  markTicketStatus,
} from "@/app/(bench)/tickets/actions";
import {
  extraDoNextOutcomes,
  markAsLabel,
  markableStatuses,
  type DoNextCheck,
} from "@/lib/tickets/do-next";
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
  check,
}: {
  ticketId: string;
  status: TicketStatus;
  check: DoNextCheck | null;
}) {
  const marks = markableStatuses(status);
  const extras = extraDoNextOutcomes(check);

  return (
    <>
      <section className="segment sticky top-[3.25rem] z-10 space-y-3 bg-white p-3 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Jot a note</h2>
        <NoteForm ticketId={ticketId} />
      </section>
      {marks.length > 0 || extras.length > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Optional accelerators">
          {marks.map((mark) => (
            <form key={mark} action={markTicketStatus}>
              <input type="hidden" name="ticket_id" value={ticketId} />
              <input type="hidden" name="status" value={mark} />
              <QuietChip>{markAsLabel(mark)}</QuietChip>
            </form>
          ))}
          {extras.map((outcome) => (
            <form key={outcome.id} action={applyDoNextOutcome}>
              <input type="hidden" name="ticket_id" value={ticketId} />
              <input type="hidden" name="outcome_id" value={outcome.id} />
              <QuietChip>{outcome.label}</QuietChip>
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
        placeholder="What you saw, what you tried…"
        aria-label="Note or finding"
      />
      <PrimarySubmit>Save note</PrimarySubmit>
    </form>
  );
}
