import { NOT_CONFIGURED_MESSAGE } from "@/lib/assistant/copy";
import { assistantDailyLimit } from "@/lib/assistant/limit";
import { parseAssistantRequest } from "@/lib/assistant/messages";
import { assistantApiKey, assistantLanguageModel, assistantModelName } from "@/lib/assistant/model";
import { assistantStatus, runAssistantTurn } from "@/lib/assistant/turn";
import { SupabaseAssistantUsage } from "@/lib/assistant/usage";
import { isOwnerEmail } from "@/lib/auth/owner";
import { getBenchSession } from "@/lib/auth/session";
import { SupabaseJobRepository } from "@/lib/jobs/supabase-repository";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export async function POST(request: Request) {
  const session = await getBenchSession();
  if (!session || !isOwnerEmail(session.user.email)) {
    return json(401, { ok: false, code: "unauthorised", message: "Sign in as the owner." });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json(400, { ok: false, code: "validation", message: "The body is not valid JSON." });
  }

  const parsed = parseAssistantRequest(payload);
  if (!parsed.ok) return json(400, { ok: false, code: "validation", message: parsed.message });

  const apiKey = assistantApiKey();
  if (!apiKey) {
    return json(503, { ok: false, code: "not_configured", message: NOT_CONFIGURED_MESSAGE });
  }

  const supabase = await createClient();
  const result = await runAssistantTurn({
    messages: parsed.messages,
    scopeRef: parsed.scopeRef,
    apiKey,
    repo: new SupabaseJobRepository(supabase),
    usage: new SupabaseAssistantUsage(supabase),
    dailyLimit: assistantDailyLimit(),
    now: new Date(),
    model: assistantLanguageModel(apiKey, assistantModelName()),
  });
  return json(assistantStatus(result), result);
}
