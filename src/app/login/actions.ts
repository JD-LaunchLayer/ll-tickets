"use server";

import { ownerEmail } from "@/lib/auth/owner";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { siteOrigin } from "@/lib/site";
import { redirect } from "next/navigation";

export type SignInState = { error: string | null; sent: boolean };

export async function sendSignInLink(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Supabase is not configured. Copy .env.example to .env.local and add the project URL and publishable key.",
      sent: false,
    };
  }

  const owner = ownerEmail();
  if (!owner) {
    return {
      error: "OWNER_EMAIL is not set, so sign-in is switched off.",
      sent: false,
    };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Email is required.", sent: false };
  if (email !== owner) {
    return { error: "Only the workshop owner can sign in.", sent: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteOrigin()}/auth/callback`,
      shouldCreateUser: false,
    },
  });
  if (error) {
    return {
      error:
        "The sign-in link could not be sent. The owner user must already exist in Supabase Auth, and the site URL must be on the redirect allow list.",
      sent: false,
    };
  }

  return { error: null, sent: true };
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
