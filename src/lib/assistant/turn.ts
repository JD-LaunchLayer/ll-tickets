import { generateText, isStepCount, type LanguageModel } from "ai";
import { FAILED_MESSAGE, LIMIT_MESSAGE, NOT_CONFIGURED_MESSAGE } from "@/lib/assistant/copy";
import {
  MAX_OUTPUT_TOKENS,
  TOOL_STEP_LIMIT,
  usageDay,
  type AssistantUsageStore,
} from "@/lib/assistant/limit";
import { parseAssistantRequest, type AssistantMessage } from "@/lib/assistant/messages";
import { buildSystemPrompt, type PromptNote, type PromptScope } from "@/lib/assistant/prompt";
import { stripForModel } from "@/lib/assistant/privacy";
import { createAssistantTools, type AssistantToolContext } from "@/lib/assistant/tools";
import type { Note } from "@/lib/jobs/domain";
import { reasonLine } from "@/lib/bench/reason";
import { canonicalJobRef } from "@/lib/jobs/ref";
import { RepositoryError } from "@/lib/jobs/repository-error";
import type { JobRepository } from "@/lib/jobs/repository";

export type AssistantTurnResult =
  | { ok: true; reply: string; reasons: string[] }
  | { ok: false; code: "not_configured"; message: string }
  | { ok: false; code: "limit"; message: string }
  | { ok: false; code: "validation"; message: string }
  | { ok: false; code: "failed"; message: string; reason: string | null };

export function assistantStatus(result: AssistantTurnResult): number {
  if (result.ok) return 200;
  if (result.code === "not_configured") return 503;
  if (result.code === "limit") return 429;
  if (result.code === "validation") return 400;
  return 500;
}

function failureReason(error: unknown): string | null {
  if (error instanceof RepositoryError) return reasonLine(error);
  return null;
}

export async function runAssistantTurn(input: {
  messages: AssistantMessage[];
  scopeRef: string | null;
  apiKey: string;
  repo: JobRepository;
  usage: AssistantUsageStore;
  dailyLimit: number;
  now: Date;
  model: LanguageModel | null;
  maxOutputTokens?: number;
  stepLimit?: number;
}): Promise<AssistantTurnResult> {
  const parsed = parseAssistantRequest({ messages: input.messages, scopeRef: input.scopeRef });
  if (!parsed.ok) return { ok: false, code: "validation", message: parsed.message };

  if (!input.apiKey.trim()) {
    return { ok: false, code: "not_configured", message: NOT_CONFIGURED_MESSAGE };
  }
  if (!input.model) {
    return { ok: false, code: "not_configured", message: NOT_CONFIGURED_MESSAGE };
  }

  const phones = new Set<string>();
  let scope: PromptScope | null = null;
  if (parsed.scopeRef) {
    const ref = canonicalJobRef(parsed.scopeRef);
    if (!ref) return { ok: false, code: "validation", message: "That job ref is not valid." };
    let job;
    try {
      job = await input.repo.getJobByRef(ref);
    } catch (error) {
      return { ok: false, code: "failed", message: FAILED_MESSAGE, reason: failureReason(error) };
    }
    if (!job) return { ok: false, code: "validation", message: "No job with that ref." };
    if (job.phone) phones.add(job.phone);
    let notes: Note[];
    try {
      notes = await input.repo.listNotes(job.id);
    } catch (error) {
      return { ok: false, code: "failed", message: FAILED_MESSAGE, reason: failureReason(error) };
    }
    scope = {
      ref: job.ref,
      customerName: job.customerName,
      deviceLabel: job.deviceLabel,
      reportedFault: job.reportedFault,
      status: job.status,
      nextMove: job.nextMove,
      notes: notes.map((note): PromptNote => ({ tag: note.tag, text: note.text })),
    };
  }

  let allowed = false;
  try {
    allowed = await input.usage.consume(usageDay(input.now), input.dailyLimit);
  } catch (error) {
    return { ok: false, code: "failed", message: FAILED_MESSAGE, reason: failureReason(error) };
  }
  if (!allowed) return { ok: false, code: "limit", message: LIMIT_MESSAGE };

  const ctx: AssistantToolContext = {
    repo: input.repo,
    now: input.now,
    scopeRef: scope?.ref ?? null,
    phones,
    reasons: [],
  };

  const instructions = stripForModel(buildSystemPrompt(scope), [...phones]);
  const system = typeof instructions === "string" ? instructions : buildSystemPrompt(scope);

  try {
    const result = await generateText({
      model: input.model,
      instructions: system,
      messages: parsed.messages.map((message) => ({
        role: message.role,
        content: message.text,
      })),
      tools: createAssistantTools(ctx),
      stopWhen: isStepCount(input.stepLimit ?? TOOL_STEP_LIMIT),
      maxOutputTokens: input.maxOutputTokens ?? MAX_OUTPUT_TOKENS,
    });
    const reply = result.text.trim() || "Done.";
    return { ok: true, reply, reasons: ctx.reasons };
  } catch (error) {
    return { ok: false, code: "failed", message: FAILED_MESSAGE, reason: failureReason(error) };
  }
}
