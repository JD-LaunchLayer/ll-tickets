export type FormState = {
  error: string | null;
  reason: string | null;
  notice?: string | null;
  noticeId?: string;
  /** Previous status when Undo should put it back. */
  undoStatus?: string | null;
  undoRef?: string | null;
};

export const idleForm: FormState = { error: null, reason: null };
