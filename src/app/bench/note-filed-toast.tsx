"use client";

import { useState } from "react";
import { setStatusAction } from "@/app/bench/actions";
import { SaveToast } from "@/app/bench/toast";
import { UndoToast } from "@/app/bench/undo-toast";
import { idleForm, type FormState } from "@/lib/bench/form-state";

/** Note-filed line. A status move uses the same Undo toast as archive. */
export function NoteFiledToast({ state, jobRef }: { state: FormState; jobRef: string }) {
  const [hiddenId, setHiddenId] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const noticeId = state.noticeId;
  const visible = Boolean(state.notice) && Boolean(noticeId) && noticeId !== hiddenId;
  const canUndo = Boolean(state.undoStatus) && state.undoRef === jobRef;

  async function undo() {
    if (!state.undoStatus || !noticeId || pending) return;
    setPending(true);
    const data = new FormData();
    data.set("ref", state.undoRef || jobRef);
    data.set("status", state.undoStatus);
    try {
      const result = await setStatusAction(idleForm, data);
      if (!result.error) setHiddenId(noticeId);
    } catch {
      /* Leave the line up so Undo can be tried again. */
    } finally {
      setPending(false);
    }
  }

  if (!visible || !state.notice || !noticeId) return null;
  if (canUndo) {
    return <UndoToast message={state.notice} token={noticeId} onUndo={() => void undo()} />;
  }
  return <SaveToast message={state.notice} token={noticeId} />;
}
