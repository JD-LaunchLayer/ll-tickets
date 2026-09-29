"use client";

import { useActionState } from "react";
import { ErrorPanel } from "@/app/bench/error-panel";
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
    <form action={action} className="login-form">
      {!configured ? (
        <p className="warn-panel">
          Add Supabase keys in <code>.env.local</code> (see <code>.env.example</code>) before signing in.
        </p>
      ) : null}
      {configured && !ownerConfigured ? (
        <p className="warn-panel">
          Set <code>OWNER_EMAIL</code> to the workshop owner before signing in.
        </p>
      ) : null}
      <label className="field">
        <span className="field-label field-label-lg">Email</span>
        <input className="login-input" type="email" name="email" autoComplete="username" required readOnly={pending} />
      </label>
      {state.sent ? (
        <p className="login-sent" role="status">
          Check your inbox for the sign-in link.
        </p>
      ) : null}
      {state.error ? <ErrorPanel message={state.error} /> : null}
      <button className="tech-btn-primary" type="submit" disabled={pending || !ready}>
        {pending ? "Sending…" : state.sent ? "Send again" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
