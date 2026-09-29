import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { ORG } from "@/lib/org";

export function BenchShell({
  title,
  children,
  backHref,
  showSignOut = false,
}: {
  title: string;
  children: React.ReactNode;
  backHref?: string;
  showSignOut?: boolean;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between gap-3">
        {backHref ? (
          <Link href={backHref} className="inline-flex min-h-12 items-center text-base font-semibold text-[#2563eb]">
            Jobs
          </Link>
        ) : (
          <p className="text-sm font-semibold text-[#3b82f6]">{ORG.name}</p>
        )}
        {showSignOut ? (
          <form action={signOut}>
            <button className="tech-btn-quiet" type="submit">
              Sign out
            </button>
          </form>
        ) : null}
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </main>
  );
}
