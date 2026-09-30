"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { saveAssistantFinding } from "@/lib/assistant/save-note";
import { noteFiledNotice } from "@/lib/bench/auto-status";
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
  const notice = noteFiledNotice(result.value.statusMove, "Saved to notes.");
  return {
    error: null,
    reason: null,
    notice: notice.notice,
    noticeId: randomUUID(),
    undoStatus: notice.undoStatus,
    undoRef: notice.undoStatus ? result.value.job.ref : null,
  };
}
