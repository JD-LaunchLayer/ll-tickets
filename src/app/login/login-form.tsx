"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/app/login/actions";

const initial: SignInState = { error: null };

export function LoginForm({ configured }: { configured: boolean }) {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <form action={action} className="segment space-y-3 p-4">
      {!configured ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Add Supabase keys in <code>.env.local</code> (see <code>.env.example</code>)
          before signing in.
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
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Password</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </label>
      {state.error ? (
        <p className="text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <button
        className="tech-btn-primary"
        type="submit"
        disabled={pending || !configured}
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
