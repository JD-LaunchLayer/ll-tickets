"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createTicket } from "@/app/(bench)/tickets/actions";

function Submit({ arrival }: { arrival: "walk_in" | "appointment" }) {
  const { pending } = useFormStatus();
  return (
    <button className="tech-btn-primary" type="submit" disabled={pending}>
      {pending
        ? "Opening ticket…"
        : arrival === "walk_in"
          ? "Open ticket"
          : "Book ticket"}
    </button>
  );
}

export function CreateTicketForm({
  defaultAppointment,
}: {
  defaultAppointment: string;
}) {
  const [arrival, setArrival] = useState<"walk_in" | "appointment">("walk_in");

  return (
    <form className="space-y-3" action={createTicket}>
      <section className="segment space-y-3 p-3">
        <h2 className="text-sm font-semibold text-slate-900">Customer</h2>
        <label className="block">
          <span className="text-sm text-slate-700">Name</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
            name="customer_name"
            required
            autoComplete="name"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-700">Phone</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
            name="phone"
            type="tel"
            autoComplete="tel"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-700">Email</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
            name="email"
            type="email"
            autoComplete="email"
          />
        </label>
      </section>

      <section className="segment space-y-3 p-3">
        <h2 className="text-sm font-semibold text-slate-900">Device</h2>
        <label className="block">
          <span className="text-sm text-slate-700">What is it?</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
            name="device_label"
            required
            placeholder="iPhone 13, ThinkPad, HP all-in-one…"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-700">Serial (optional)</span>
          <input
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
            name="serial"
          />
        </label>
      </section>

      <section className="segment space-y-3 p-3">
        <h2 className="text-sm font-semibold text-slate-900">Job</h2>
        <label className="block">
          <span className="text-sm text-slate-700">Symptom</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
            name="symptom"
            required
            rows={3}
            placeholder="Won't charge, cracked lid, no power…"
          />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-slate-700">When</legend>
          <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <input
              type="radio"
              name="arrival_kind"
              value="walk_in"
              checked={arrival === "walk_in"}
              onChange={() => setArrival("walk_in")}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">Here now</span>
              <span className="block text-xs text-slate-500">
                They are at the counter. Opens the ticket straight onto the bench — no second intake.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <input
              type="radio"
              name="arrival_kind"
              value="appointment"
              checked={arrival === "appointment"}
              onChange={() => setArrival("appointment")}
              className="mt-1"
            />
            <span>
              <span className="block text-sm font-medium">Appointment</span>
              <span className="block text-xs text-slate-500">
                Next shop slot, never a silent midnight.
              </span>
            </span>
          </label>
        </fieldset>
        {arrival === "appointment" ? (
          <label className="block">
            <span className="text-sm text-slate-700">Due</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
              type="datetime-local"
              name="appointment_at"
              defaultValue={defaultAppointment}
              required
            />
          </label>
        ) : null}
      </section>

      <Submit arrival={arrival} />
    </form>
  );
}
