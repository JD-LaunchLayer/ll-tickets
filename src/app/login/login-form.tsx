"use client";

import { useActionState } from "react";
import { sendSignInLink, type SignInState } from "@/app/login/actions";

const initial: SignInState = { error: null, sent: false };

export function LoginForm({
  configured,
  ownerConfigured,
}: {
  configured: boolean;
  ownerConfigured: boolean;
}) {
  const [state, action, pending] = useActionState(sendSignInLink, initial);
  const ready = configured && ownerConfigured;

  return (
    <form action={action} className="segment space-y-3 p-4">
      {!configured ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Add Supabase keys in <code>.env.local</code> (see <code>.env.example</code>) before
          signing in.
        </p>
      ) : null}
      {configured && !ownerConfigured ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Set <code>OWNER_EMAIL</code> to the workshop owner before signing in.
        </p>
      ) : null}
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Email</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
          type="email"
          name="email"
          autoComplete="username"
          required
        />
      </label>
      {state.sent ? (
        <p className="text-sm text-slate-700" role="status">
          Check your inbox for the sign-in link.
        </p>
      ) : null}
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <button className="tech-btn-primary" type="submit" disabled={pending || !ready}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
