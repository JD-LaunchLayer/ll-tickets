"use client";

import { useFormStatus } from "react-dom";
import { setBenchState } from "@/app/(bench)/tickets/actions";
import { BENCH_STATE_LABELS } from "@/lib/tickets/labels";
import { BENCH_STATES, type BenchState } from "@/lib/tickets/types";

function StateSubmit({
  label,
  current,
}: {
  label: string;
  current: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full rounded-lg px-2 py-2 text-center text-sm font-medium ${
        current ? "bg-[#3b82f6] text-white" : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

export function BenchStatePicker({
  ticketId,
  state,
}: {
  ticketId: string;
  state: BenchState;
}) {
  return (
    <div
      aria-label="Where this job is"
      className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-white p-1"
    >
      {BENCH_STATES.map((item) => (
        <form key={item} action={setBenchState} className="min-w-0">
          <input type="hidden" name="ticket_id" value={ticketId} />
          <input type="hidden" name="state" value={item} />
          <StateSubmit
            label={BENCH_STATE_LABELS[item]}
            current={item === state}
          />
        </form>
      ))}
    </div>
  );
}
