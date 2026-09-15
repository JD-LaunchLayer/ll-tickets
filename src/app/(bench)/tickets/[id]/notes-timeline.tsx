import { formatShopDateTime } from "@/lib/tickets/datetime";
import { findingNotes } from "@/lib/tickets/findings";
import type { TicketNote } from "@/lib/tickets/types";

export function NotesTimeline({ notes }: { notes: TicketNote[] }) {
  const findings = findingNotes(notes);

  if (findings.length === 0) {
    return (
      <section>
        <h2 className="text-xs text-slate-500">Findings</h2>
        <p className="mt-1 text-sm text-slate-500">No findings yet.</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-xs text-slate-500">Findings</h2>
      <ol className="mt-1 divide-y divide-slate-200 border-y border-slate-200">
        {findings.map((note) => (
          <li key={note.id} className="py-2">
            <p className="whitespace-pre-wrap text-[15px] text-slate-900">
              {note.body}
            </p>
            <time
              className="mt-0.5 block text-xs text-slate-500"
              dateTime={note.created_at}
            >
              {formatShopDateTime(new Date(note.created_at))}
            </time>
          </li>
        ))}
      </ol>
    </section>
  );
}
