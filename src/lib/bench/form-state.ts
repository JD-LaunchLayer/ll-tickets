export type FormState = {
  error: string | null;
  reason: string | null;
  notice?: string | null;
  noticeId?: string;
};

export const idleForm: FormState = { error: null, reason: null };
