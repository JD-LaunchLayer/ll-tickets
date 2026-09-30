export type FormState = {
  error: string | null;
  reason: string | null;
  notice?: string | null;
  noticeId?: string;
  /** Previous status when Undo should put it back. */
  undoStatus?: string | null;
  undoRef?: string | null;
  /** New-job values to put back after React resets the form. */
  draft?: JobDraft | null;
  /** Which new-job field the message belongs to, when it can be mapped. */
  field?: JobFormField | null;
  fieldMessage?: string | null;
  /** Changes when an error returns so the inputs remount with the draft. */
  formKey?: string;
};

export type JobFormField = "customerName" | "deviceLabel" | "reportedFault" | "phone";

export type JobDraft = {
  customerName: string;
  deviceLabel: string;
  reportedFault: string;
  phone: string;
};

export const JOB_FIELD_INPUT: Record<JobFormField, string> = {
  customerName: "customer_name",
  deviceLabel: "device_label",
  reportedFault: "reported_fault",
  phone: "phone",
};

export const idleForm: FormState = { error: null, reason: null };

export function fieldForBenchMessage(message: string): JobFormField | null {
  if (message.startsWith("Phone number")) return "phone";
  if (message.startsWith("Customer name")) return "customerName";
  if (message.startsWith("Device")) return "deviceLabel";
  if (message.startsWith("Reported fault")) return "reportedFault";
  return null;
}

/** Keep what was typed. Attach the message to a field when the wording names one. */
export function retainJobForm(
  draft: JobDraft,
  result: { message: string; reason?: string },
  formKey: string,
): FormState {
  const field = fieldForBenchMessage(result.message);
  if (field) {
    return {
      error: null,
      reason: null,
      draft,
      field,
      fieldMessage: result.message,
      formKey,
    };
  }
  return {
    error: result.message,
    reason: result.reason ?? null,
    draft,
    field: null,
    fieldMessage: null,
    formKey,
  };
}
