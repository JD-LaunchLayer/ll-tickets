import { requireOwnerSession } from "@/lib/auth/session";
import { SupabaseJobRepository } from "@/lib/jobs/supabase-repository";
import { createClient } from "@/lib/supabase/server";

export async function ownerContext() {
  const session = await requireOwnerSession();
  const supabase = await createClient();
  return { session, supabase, repo: new SupabaseJobRepository(supabase) };
}
