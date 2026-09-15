import { createClient } from "@/lib/supabase/server";
import { displayNameFromUser, ORG, type BenchSession } from "@/lib/org";
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

export async function requireBenchSession(): Promise<BenchSession> {
  const session = await getBenchSession();
  if (!session) redirect("/login");
  return session;
}
