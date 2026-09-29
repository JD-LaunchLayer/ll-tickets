import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { ORG } from "@/lib/org";

export function BenchShell({
  title,
  children,
  backHref,
  backLabel = "Jobs",
  askHref,
  showSignOut = false,
  fill = false,
}: {
  title: string;
  children: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  askHref?: string;
  showSignOut?: boolean;
  fill?: boolean;
}) {
  return (
    <main
      className={
        fill
          ? "mx-auto flex h-dvh w-full max-w-lg flex-col px-4 pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          : "mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {backHref ? (
          <Link href={backHref} className="inline-flex min-h-12 items-center text-base font-semibold text-[#2563eb]">
            {backLabel}
          </Link>
        ) : (
          <p className="text-sm font-semibold text-[#3b82f6]">{ORG.name}</p>
        )}
        <div className="flex items-center gap-1">
          {askHref ? (
            <Link href={askHref} className="inline-flex min-h-12 items-center text-base font-semibold text-[#2563eb]">
              Ask the record
            </Link>
          ) : null}
          {showSignOut ? (
            <form action={signOut}>
              <button className="tech-btn-quiet" type="submit">
                Sign out
              </button>
            </form>
          ) : null}
        </div>
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
      <div className={fill ? "mt-3 flex min-h-0 flex-1 flex-col" : "mt-4 flex flex-col gap-4"}>{children}</div>
    </main>
  );
}
