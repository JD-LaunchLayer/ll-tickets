import { signOut } from "@/app/(bench)/tickets/actions";
import { BenchHeader } from "@/components/bench-header";
import { formatShopDateTime } from "@/lib/tickets/datetime";
import { NOTE_KIND_LABELS } from "@/lib/tickets/labels";
import { listRecentNotes } from "@/lib/tickets/queries";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function MorePage() {
  const notes = await listRecentNotes();

  return (
    <>
      <BenchHeader title="More" backHref="/tickets" />
      <main className="flex flex-1 flex-col gap-3 px-4 py-3">
        <section className="segment space-y-2 p-3">
          <h2 className="text-sm font-semibold text-slate-900">Help</h2>
          <p className="text-sm text-slate-700">
            Here now opens the ticket immediately — no second intake gate. Appointments
            use the next shop slot in Europe/London, never a silent midnight.
          </p>
          <p className="text-sm text-slate-700">
            Statuses are labels only: intake, diagnose, parts, done. Open a ticket and
            jot what’s happening. Diagnose / Parts / Done chips are optional. Lists:
            Today, Active, Waiting, Done.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">History</h2>
          {notes.length === 0 ? (
            <p className="segment px-3 py-3 text-sm text-slate-600">No notes yet.</p>
          ) : (
            <ul className="space-y-2">
              {notes.map((note) => (
                <li key={note.id}>
                  <Link
                    href={`/tickets/${note.ticket_id}`}
                    className="segment block p-3"
                  >
                    <p className="text-xs text-slate-500">
                      {NOTE_KIND_LABELS[note.kind]}
                      {note.customer_name ? ` · ${note.customer_name}` : ""}
                      {" · "}
                      {formatShopDateTime(new Date(note.created_at))}
                    </p>
                    <p className="mt-1 line-clamp-3 text-sm text-slate-800">{note.body}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form action={signOut}>
          <button type="submit" className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800">
            Sign out
          </button>
        </form>
      </main>
    </>
  );
}
