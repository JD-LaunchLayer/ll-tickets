"use client";

import { signOut } from "@/app/login/actions";

export function SignOutButton() {
  return (
    <form
      action={signOut}
      className="top-bar-sign-out-form"
      onSubmit={() => {
        const keys: string[] = [];
        for (let index = 0; index < sessionStorage.length; index += 1) {
          const key = sessionStorage.key(index);
          if (key?.startsWith("ll-")) keys.push(key);
        }
        for (const key of keys) sessionStorage.removeItem(key);
      }}
    >
      <button className="top-bar-sign-out" type="submit">
        Sign out
      </button>
    </form>
  );
}

/** Compact bar with no Back control: title on the left, optional Sign out on the right. */
export function PlainTopBar({ title, showSignOut = false }: { title: string; showSignOut?: boolean }) {
  return (
    <header className="top-bar">
      <div className="top-bar-row top-bar-row-plain">
        <h1 className="top-bar-title top-bar-title-md">{title}</h1>
        {showSignOut ? <SignOutButton /> : null}
      </div>
    </header>
  );
}

/** Title slot while a banded screen is loading. No Sign out. */
export function LoadingTopBar() {
  return (
    <header className="top-bar">
      <div className="top-bar-row top-bar-row-plain">
        <div className="skeleton skeleton-bar-title" aria-hidden="true" />
      </div>
    </header>
  );
}
