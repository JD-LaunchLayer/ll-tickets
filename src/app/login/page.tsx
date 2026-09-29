import { LoginForm } from "@/app/login/login-form";
import { ownerEmail } from "@/lib/auth/owner";
import { ORG } from "@/lib/org";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

const LINK_ERRORS: Record<string, string> = {
  owner: "That sign-in is not the workshop owner.",
  link: "That sign-in link is invalid or has expired.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const query = await searchParams;
  const code = Array.isArray(query.error) ? query.error[0] : query.error;
  const linkError = code ? LINK_ERRORS[code] : undefined;

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-8">
      <p className="text-sm font-semibold text-[#3b82f6]">{ORG.name}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Jobs</h1>
      <p className="mt-1 text-sm text-slate-600">
        {ORG.shop}. Sign in with the owner email link.
      </p>
      {linkError ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {linkError}
        </p>
      ) : null}
      <div className="mt-6">
        <LoginForm configured={isSupabaseConfigured()} ownerConfigured={ownerEmail() !== null} />
      </div>
    </main>
  );
}
