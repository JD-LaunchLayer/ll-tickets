"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { saveAssistantFinding } from "@/lib/assistant/save-note";
import { NAME_REPLACED_MESSAGE } from "@/lib/jobs/name-scrub";
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
  const filed = noteFiledNotice(result.value.statusMove, "Saved to notes.");
  const notice = result.value.nameReplaced ? `${filed.notice} ${NAME_REPLACED_MESSAGE}` : filed.notice;
  return {
    error: null,
    reason: null,
    notice,
    noticeId: randomUUID(),
    undoStatus: filed.undoStatus,
    undoRef: filed.undoStatus ? result.value.job.ref : null,
  };
}
