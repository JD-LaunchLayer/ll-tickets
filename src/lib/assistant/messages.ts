import { HISTORY_MESSAGE_LIMIT } from "@/lib/assistant/limit";

export type AssistantMessage = {
  role: "user" | "assistant";
  text: string;
};

const TEXT_LIMIT = 4000;

export function parseAssistantRequest(
  body: unknown,
): { ok: true; messages: AssistantMessage[]; scopeRef: string | null } | { ok: false; message: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "The body must be a JSON object." };
  }
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.messages)) {
    return { ok: false, message: "Send the conversation as messages." };
  }
  if (record.messages.length > 40) {
    return { ok: false, message: "That conversation is too long. Clear it and start again." };
  }

  const messages: AssistantMessage[] = [];
  for (const item of record.messages) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, message: "Each message needs a role and text." };
    }
    const message = item as Record<string, unknown>;
    if (message.role !== "user" && message.role !== "assistant") {
      return { ok: false, message: "Each message needs a role and text." };
    }
    if (typeof message.text !== "string" || !message.text.trim()) {
      return { ok: false, message: "Each message needs text." };
    }
    messages.push({
      role: message.role,
      text: message.text.trim().slice(0, TEXT_LIMIT),
    });
  }

  if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
    return { ok: false, message: "Say what you want to ask." };
  }

  let scopeRef: string | null = null;
  if ("scopeRef" in record && record.scopeRef != null && record.scopeRef !== "") {
    if (typeof record.scopeRef !== "string") {
      return { ok: false, message: "That job ref is not valid." };
    }
    scopeRef = record.scopeRef.trim();
    if (!scopeRef) scopeRef = null;
  }

  return { ok: true, messages: messages.slice(-HISTORY_MESSAGE_LIMIT), scopeRef };
}
