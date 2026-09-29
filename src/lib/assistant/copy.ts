export const NOT_CONFIGURED_MESSAGE = "Assistant is not set up yet.";

/** Empty job chat. He is diagnosing this job. */
export const JOB_SUGGESTIONS = [
  "What should I test next?",
  "Summarise this job",
  "Seen anything like this before?",
] as const;

/** Empty list chat. No single job is open. */
export const LIST_SUGGESTIONS = ["Which jobs are waiting on me?", "Find jobs like..."] as const;

export function suggestionsFor(scopeRef: string | null): readonly string[] {
  return scopeRef ? JOB_SUGGESTIONS : LIST_SUGGESTIONS;
}

/** "Find jobs like..." stays in the box so he can finish the sentence. The others send. */
export function suggestionDraft(prompt: string): { send: boolean; text: string } {
  if (prompt.endsWith("...")) return { send: false, text: `${prompt} ` };
  return { send: true, text: prompt };
}

export const LIMIT_MESSAGE = "Today's limit is used up. Try again tomorrow.";

export const FAILED_MESSAGE = "That failed.";

/** What the model is told when a write fails. No database detail. */
export const MODEL_FAILED = "that failed";
