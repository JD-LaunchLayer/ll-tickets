"use client";

import { useFormStatus } from "react-dom";
import { createTicket } from "@/app/(bench)/tickets/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="tech-btn-primary" type="submit" disabled={pending}>
      {pending ? "Opening ticket…" : "Open ticket"}
    </button>
  );
}

export function CreateTicketForm() {
  return (
    <form className="space-y-3" action={createTicket}>
      <section className="segment space-y-3 p-3">
        <label className="block">
          <span className="text-sm text-slate-700">Who</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
            name="customer_name"
            required
            autoComplete="name"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-700">What is wrong</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
            name="symptom"
            required
            rows={3}
            placeholder="Won't charge, cracked lid, no power…"
          />
        </label>
      </section>
      <Submit />
    </form>
  );
}
