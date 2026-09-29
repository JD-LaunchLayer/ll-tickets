import { isOwnerEmail } from "@/lib/auth/owner";
import { displayNameFromUser, ORG, type BenchSession } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function getBenchSession(): Promise<BenchSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;
  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: displayNameFromUser(user),
    },
    org: ORG,
  };
}

export async function requireOwnerSession(): Promise<BenchSession> {
  const session = await getBenchSession();
  if (!session) redirect("/login");
  if (!isOwnerEmail(session.user.email)) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login?error=owner");
  }
  return session;
}
