"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  addTicketNote,
  advanceTicketStatus,
  applyDoNextOutcome,
} from "@/app/(bench)/tickets/actions";
import { advanceLabel, type DoNextCheck } from "@/lib/tickets/do-next";
import type { TicketStatus } from "@/lib/tickets/types";

function PrimarySubmit({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="tech-btn-primary">
      {children}
    </button>
  );
}

function QuietSubmit({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800"
    >
      {children}
    </button>
  );
}

export function DoNextPanel({
  ticketId,
  status,
  check,
}: {
  ticketId: string;
  status: TicketStatus;
  check: DoNextCheck | null;
}) {
  const advance = advanceLabel(status);

  if (check) {
    return (
      <section className="segment sticky top-[3.25rem] z-10 space-y-3 bg-white p-3 shadow-sm">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Do next
          </p>
          <h2 className="text-base font-semibold text-slate-900">{check.next}</h2>
          <p className="mt-1 text-sm text-slate-600">{check.why}</p>
        </div>
        <div className="grid gap-2">
          {check.outcomes.map((outcome, index) => (
            <form key={outcome.id} action={applyDoNextOutcome}>
              <input type="hidden" name="ticket_id" value={ticketId} />
              <input type="hidden" name="outcome_id" value={outcome.id} />
              {index === 0 ? (
                <PrimarySubmit>{outcome.label}</PrimarySubmit>
              ) : (
                <QuietSubmit>{outcome.label}</QuietSubmit>
              )}
            </form>
          ))}
        </div>
        <details className="text-sm text-slate-700">
          <summary className="cursor-pointer text-slate-600">Add a note</summary>
          <div className="mt-2">
            <NoteForm ticketId={ticketId} primary={false} />
          </div>
        </details>
      </section>
    );
  }

  return (
    <section className="segment sticky top-[3.25rem] z-10 space-y-3 bg-white p-3 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        Do next
      </p>
      <NoteForm ticketId={ticketId} primary />
      {advance ? (
        <form action={advanceTicketStatus}>
          <input type="hidden" name="ticket_id" value={ticketId} />
          <QuietSubmit>{advance}</QuietSubmit>
        </form>
      ) : null}
    </section>
  );
}

function NoteForm({
  ticketId,
  primary,
}: {
  ticketId: string;
  primary: boolean;
}) {
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
          <span className="block rounded-lg px-2 py-1 peer-checked:bg-slate-100 peer-checked:font-medium">
            Note
          </span>
        </label>
        <label className="flex-1 text-center text-sm">
          <input type="radio" name="kind" value="finding" className="peer sr-only" />
          <span className="block rounded-lg px-2 py-1 peer-checked:bg-slate-100 peer-checked:font-medium">
            Finding
          </span>
        </label>
      </div>
      <textarea
        name="body"
        required
        rows={primary ? 3 : 2}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
        placeholder={primary ? "Add a note" : "Note"}
      />
      {primary ? <PrimarySubmit>Save note</PrimarySubmit> : <QuietSubmit>Save note</QuietSubmit>}
    </form>
  );
}
