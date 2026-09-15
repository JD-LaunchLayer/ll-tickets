"use client";

import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { addTicketNote } from "@/app/(bench)/tickets/actions";

function Send({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="tech-btn-primary">
      {pending ? "Sending…" : children}
    </button>
  );
}

export function NoteComposer({ ticketId }: { ticketId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [ticketId]);

  return (
    <section className="sticky bottom-0 z-10 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <form
        ref={formRef}
        className="space-y-2"
        action={async (formData) => {
          await addTicketNote(formData);
          formRef.current?.reset();
          inputRef.current?.focus();
        }}
      >
        <input type="hidden" name="ticket_id" value={ticketId} />
        <textarea
          ref={inputRef}
          name="body"
          required
          rows={4}
          autoFocus
          enterKeyHint="send"
          autoComplete="off"
          className="min-h-[7rem] w-full rounded-lg border border-slate-200 px-3 py-3 text-base"
          placeholder="What's happening on this job…"
          aria-label="Finding"
        />
        <Send>Send</Send>
      </form>
    </section>
  );
}
