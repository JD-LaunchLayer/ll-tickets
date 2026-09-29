import { signOut } from "@/app/login/actions";
import { requireOwnerSession } from "@/lib/auth/session";
import { ORG } from "@/lib/org";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await requireOwnerSession();

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-8">
      <p className="text-sm font-semibold text-[#3b82f6]">{ORG.name}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Jobs</h1>
      <p className="mt-3 text-sm text-slate-700">
        Signed in as {session.user.email}. Jobs are filed by talking to the GPT. The phone view is
        not in this version.
      </p>
      <p className="mt-3 text-sm text-slate-600">
        The action spec is at <code>/openapi.json</code>. Setup steps are in{" "}
        <code>docs/gpt-setup.md</code>.
      </p>
      <form action={signOut} className="mt-6">
        <button className="tech-btn-primary" type="submit">
          Sign out
        </button>
      </form>
    </main>
  );
}
