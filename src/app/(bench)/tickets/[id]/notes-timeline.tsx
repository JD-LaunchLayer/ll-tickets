import { formatShopDateTime } from "@/lib/tickets/datetime";
import { NOTE_KIND_LABELS } from "@/lib/tickets/labels";
import type { TicketNote } from "@/lib/tickets/types";

export function NotesTimeline({ notes }: { notes: TicketNote[] }) {
  if (notes.length === 0) {
    return (
      <p className="text-sm text-slate-500">No notes yet.</p>
    );
  }

  return (
    <ol className="space-y-2">
      {notes.map((note) => (
        <li key={note.id} className="segment p-3">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {NOTE_KIND_LABELS[note.kind]}
            </p>
            <time className="text-xs text-slate-500" dateTime={note.created_at}>
              {formatShopDateTime(new Date(note.created_at))}
            </time>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{note.body}</p>
        </li>
      ))}
    </ol>
  );
}
