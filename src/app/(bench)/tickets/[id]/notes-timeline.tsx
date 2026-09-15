import { formatShopDateTime } from "@/lib/tickets/datetime";
import type { TicketNote } from "@/lib/tickets/types";

function isSystemLine(kind: TicketNote["kind"]): boolean {
  return kind === "status" || kind === "check_outcome";
}

export function NotesTimeline({ notes }: { notes: TicketNote[] }) {
  if (notes.length === 0) {
    return <p className="text-sm text-slate-500">No notes yet.</p>;
  }

  const newestFirst = [...notes].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <ol className="space-y-2">
      {newestFirst.map((note) =>
        isSystemLine(note.kind) ? (
          <li key={note.id}>
            <p className="text-xs text-slate-500">
              {note.body}
              {" · "}
              <time dateTime={note.created_at}>
                {formatShopDateTime(new Date(note.created_at))}
              </time>
            </p>
          </li>
        ) : (
          <li key={note.id} className="rounded-lg bg-white px-3 py-2">
            <p className="whitespace-pre-wrap text-base text-slate-900">{note.body}</p>
            <time className="mt-1 block text-xs text-slate-500" dateTime={note.created_at}>
              {formatShopDateTime(new Date(note.created_at))}
            </time>
          </li>
        ),
      )}
    </ol>
  );
}
