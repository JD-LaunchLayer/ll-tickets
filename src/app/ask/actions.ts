"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { saveAssistantFinding } from "@/lib/assistant/save-note";
import { ownerContext } from "@/lib/bench/context";
import type { FormState } from "@/lib/bench/form-state";

/** Called only from the Save button on the confirmation sheet. */
export async function saveAssistantNoteAction(input: {
  ref: string;
  text: string;
  tag: string;
}): Promise<FormState> {
  const { repo } = await ownerContext();
  const result = await saveAssistantFinding(repo, {
    ref: input.ref,
    text: input.text,
    tag: input.tag,
    confirmed: true,
    clientRequestId: `asst${randomUUID().replaceAll("-", "")}`,
    now: new Date(),
  });
  if (!result.ok) {
    return { error: result.message, reason: result.reason ?? null };
  }
  revalidatePath("/");
  revalidatePath(`/jobs/${result.value.job.ref}`);
  return { error: null, reason: null };
}
