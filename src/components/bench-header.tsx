import Link from "next/link";
import { ORG } from "@/lib/org";

type BenchHeaderProps = {
  title?: string;
  backHref?: string;
  newTicket?: boolean;
  moreHref?: string;
};

export function BenchHeader({
  title,
  backHref,
  newTicket = false,
  moreHref = "/more",
}: BenchHeaderProps) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
        {backHref ? (
          <Link
            href={backHref}
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700"
          >
            Back
          </Link>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">
              {ORG.name}
            </p>
            <p className="truncate text-xs text-slate-500">{ORG.shop}</p>
          </div>
        )}
        {title ? (
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-slate-900">
            {title}
          </h1>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {newTicket ? (
            <Link href="/tickets/new" className="tech-btn-primary !w-auto px-3">
              New
            </Link>
          ) : null}
          <Link
            href={moreHref}
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-700"
          >
            More
          </Link>
        </div>
      </div>
    </header>
  );
}
