import type { ReactNode } from "react";
import { requireBenchSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BenchLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    redirect("/login");
  }
  await requireBenchSession();
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-slate-100">
      {children}
    </div>
  );
}
