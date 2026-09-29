export const DEFAULT_DAILY_MESSAGE_LIMIT = 200;

export const HISTORY_MESSAGE_LIMIT = 12;

export const MAX_OUTPUT_TOKENS = 900;

/** Tool rounds, then the loop stops. A plain reply is one step. */
export const TOOL_STEP_LIMIT = 4;

export function parseDailyLimit(raw: string | undefined): number {
  if (!raw?.trim()) return DEFAULT_DAILY_MESSAGE_LIMIT;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return DEFAULT_DAILY_MESSAGE_LIMIT;
  return Math.floor(value);
}

export function assistantDailyLimit(): number {
  return parseDailyLimit(process.env.ASSISTANT_DAILY_MESSAGE_LIMIT);
}

/** UTC day, matching the date stored in assistant_daily_usage. */
export function usageDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export interface AssistantUsageStore {
  /** True when this message is within the day's limit. */
  consume(day: string, limit: number): Promise<boolean>;
}

export class MemoryAssistantUsage implements AssistantUsageStore {
  readonly counts = new Map<string, number>();

  async consume(day: string, limit: number): Promise<boolean> {
    const current = this.counts.get(day) ?? 0;
    if (current >= limit) return false;
    this.counts.set(day, current + 1);
    return true;
  }
}
