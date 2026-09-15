"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { addTicketNote } from "@/app/(bench)/tickets/actions";

function Send({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="tech-btn-primary">
      {children}
    </button>
  );
}

export function NoteComposer({ ticketId }: { ticketId: string }) {
  return (
    <section className="sticky bottom-0 z-10 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <form className="space-y-2" action={addTicketNote}>
        <input type="hidden" name="ticket_id" value={ticketId} />
        <textarea
          name="body"
          required
          rows={3}
          className="min-h-[5.5rem] w-full rounded-lg border border-slate-200 px-3 py-3 text-base"
          placeholder="What's happening on this job…"
          aria-label="Note"
        />
        <Send>Send</Send>
      </form>
    </section>
  );
}
