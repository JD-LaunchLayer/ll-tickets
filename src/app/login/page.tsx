import { BrandMark } from "@/app/bench/brand-mark";
import { ErrorPanel } from "@/app/bench/error-panel";
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
    <div className="app-frame">
      <header className="app-header">
        <div className="app-header-row">
          <BrandMark />
        </div>
      </header>
      <div className="app-scroll app-scroll-start">
        <h1 className="page-title">Sign in</h1>
        <p className="login-lead">{ORG.shop}. Sign in with the owner email link.</p>
        {linkError ? <ErrorPanel message={linkError} /> : null}
        <LoginForm configured={isSupabaseConfigured()} ownerConfigured={ownerEmail() !== null} />
      </div>
    </div>
  );
}
