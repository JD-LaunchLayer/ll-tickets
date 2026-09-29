import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssistantUsageStore } from "@/lib/assistant/limit";
import type { Database } from "@/lib/database.types";
import { RepositoryError } from "@/lib/jobs/repository-error";

export class SupabaseAssistantUsage implements AssistantUsageStore {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async consume(day: string, limit: number): Promise<boolean> {
    const { data, error } = await this.supabase.rpc("consume_assistant_message", {
      p_day: day,
      p_limit: limit,
    });
    if (error) throw new RepositoryError("Could not check the assistant limit.", error);
    return data === true;
  }
}
