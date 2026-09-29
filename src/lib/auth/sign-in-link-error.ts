export type SignInAuthError = {
  code?: string | null;
  status?: number | null;
};

const RATE_LIMIT =
  "Too many sign-in emails have been requested. Wait a few minutes, then try once more and open only the newest link. If this keeps happening, set up custom SMTP in Supabase.";

const OWNER_MUST_EXIST =
  "The sign-in link could not be sent. The owner user must already exist in Supabase Auth.";

const EMAIL_SEND_FAILED =
  "Supabase could not send the email. Check that the Email provider is switched on and SMTP is working.";

const FALLBACK =
  "The sign-in link could not be sent. The site URL must be on the redirect allow list. The Supabase Auth logs will show the exact reason.";

const OWNER_MISSING_CODES = new Set(["user_not_found", "signup_disabled", "otp_disabled"]);

const EMAIL_SEND_CODES = new Set(["email_provider_disabled", "unexpected_failure"]);

export function signInLinkErrorMessage(error: SignInAuthError): string {
  const code = error.code ?? "";
  const status = error.status;

  if (code === "over_email_send_rate_limit" || status === 429) {
    return RATE_LIMIT;
  }

  if (OWNER_MISSING_CODES.has(code)) {
    return OWNER_MUST_EXIST;
  }

  if (
    EMAIL_SEND_CODES.has(code) ||
    (typeof status === "number" && status >= 500 && status <= 599)
  ) {
    return EMAIL_SEND_FAILED;
  }

  return FALLBACK;
}
