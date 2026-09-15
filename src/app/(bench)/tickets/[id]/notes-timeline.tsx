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
          <li key={note.id} className="px-1">
            <p className="text-xs text-slate-500">
              {note.body}
              {" · "}
              <time dateTime={note.created_at}>
                {formatShopDateTime(new Date(note.created_at))}
              </time>
            </p>
          </li>
        ) : (
          <li key={note.id} className="segment p-3">
            <time
              className="text-xs text-slate-500"
              dateTime={note.created_at}
            >
              {formatShopDateTime(new Date(note.created_at))}
            </time>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
              {note.body}
            </p>
          </li>
        ),
      )}
    </ol>
  );
}
