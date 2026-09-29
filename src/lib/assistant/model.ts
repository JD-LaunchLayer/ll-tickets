import { createOpenAI } from "@ai-sdk/openai";
import { NOT_CONFIGURED_MESSAGE } from "@/lib/assistant/copy";

/** Small non-reasoning model, so a short reply still comes back. Override with ASSISTANT_MODEL. */
export const DEFAULT_ASSISTANT_MODEL = "gpt-4.1-mini";

export function assistantApiKey(): string {
  return process.env.OPENAI_API_KEY?.trim() ?? "";
}

export function isAssistantConfigured(): boolean {
  return assistantApiKey().length > 0;
}

export function assistantModelName(): string {
  const name = process.env.ASSISTANT_MODEL?.trim();
  return name || DEFAULT_ASSISTANT_MODEL;
}

export function assistantLanguageModel(apiKey: string, modelName: string) {
  const openai = createOpenAI({ apiKey });
  return openai(modelName as Parameters<typeof openai>[0]);
}

export function assistantSetupMessage(): string {
  return NOT_CONFIGURED_MESSAGE;
}
