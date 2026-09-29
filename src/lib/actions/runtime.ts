import { createGoogleCalendarFromEnv } from "@/lib/calendar/google";
import type { ActionRuntime } from "@/lib/actions/handle";
import { SupabaseJobRepository } from "@/lib/jobs/supabase-repository";
import { createServiceClient } from "@/lib/supabase/service";

export function productionRuntime(): ActionRuntime {
  const apiKey = process.env.ACTIONS_API_KEY?.trim() ?? "";
  const limit = Number(process.env.ACTIONS_RATE_LIMIT_PER_MINUTE ?? "60");
  let configurationError: string | null = null;
  let repo: SupabaseJobRepository | null = null;
  if (!apiKey) {
    configurationError = "ACTIONS_API_KEY is not set.";
  } else {
    try {
      repo = new SupabaseJobRepository(createServiceClient());
    } catch {
      configurationError = "Supabase service role is not configured.";
    }
  }
  return {
    repo,
    now: () => new Date(),
    calendar: createGoogleCalendarFromEnv(),
    apiKey,
    configurationError,
    rateLimit: {
      limit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 60,
      windowMs: 60_000,
    },
  };
}
