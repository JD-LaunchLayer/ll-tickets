import Link from "next/link";
import { LIST_VIEW_LABELS } from "@/lib/tickets/labels";
import { LIST_VIEWS, type ListView } from "@/lib/tickets/types";

export function ListTabs({ view }: { view: ListView }) {
  return (
    <nav
      aria-label="Ticket lists"
      className="grid grid-cols-4 gap-1 rounded-lg border border-slate-200 bg-white p-1"
    >
      {LIST_VIEWS.map((item) => {
        const active = item === view;
        return (
          <Link
            key={item}
            href={`/tickets?view=${item}`}
            className={`rounded-lg px-2 py-2 text-center text-sm font-medium ${
              active
                ? "bg-[#3b82f6] text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {LIST_VIEW_LABELS[item]}
          </Link>
        );
      })}
    </nav>
  );
}
