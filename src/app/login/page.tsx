import { LoginForm } from "@/app/login/login-form";
import { ORG } from "@/lib/org";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-8">
      <p className="text-sm font-semibold text-[#3b82f6]">{ORG.name}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Tickets</h1>
      <p className="mt-1 text-sm text-slate-600">
        {ORG.shop}. Sign in with your LaunchLayer account.
      </p>
      <div className="mt-6">
        <LoginForm configured={isSupabaseConfigured()} />
      </div>
    </main>
  );
}
