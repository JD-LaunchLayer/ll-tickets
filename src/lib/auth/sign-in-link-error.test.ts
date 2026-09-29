import { describe, expect, it } from "vitest";
import { signInLinkErrorMessage } from "@/lib/auth/sign-in-link-error";

const RATE_LIMIT =
  "Too many sign-in emails have been requested. Wait a few minutes, then try once more and open only the newest link. If this keeps happening, set up custom SMTP in Supabase.";

const OWNER_MUST_EXIST =
  "The sign-in link could not be sent. The owner user must already exist in Supabase Auth.";

const EMAIL_SEND_FAILED =
  "Supabase could not send the email. Check that the Email provider is switched on and SMTP is working.";

const FALLBACK =
  "The sign-in link could not be sent. The site URL must be on the redirect allow list. The Supabase Auth logs will show the exact reason.";

describe("signInLinkErrorMessage", () => {
  it("maps the email rate limit and HTTP 429 to the wait message", () => {
    expect(signInLinkErrorMessage({ code: "over_email_send_rate_limit" })).toBe(RATE_LIMIT);
    expect(signInLinkErrorMessage({ code: "over_email_send_rate_limit", status: 429 })).toBe(
      RATE_LIMIT,
    );
    expect(signInLinkErrorMessage({ status: 429 })).toBe(RATE_LIMIT);
    expect(signInLinkErrorMessage({ code: "over_request_rate_limit", status: 429 })).toBe(
      RATE_LIMIT,
    );
    expect(signInLinkErrorMessage({ code: "over_email_send_rate_limit", status: 500 })).toBe(
      RATE_LIMIT,
    );
  });

  it("maps a missing owner or disabled sign-up to the owner-must-exist message", () => {
    for (const code of ["user_not_found", "signup_disabled", "otp_disabled"]) {
      expect(signInLinkErrorMessage({ code, status: 422 })).toBe(OWNER_MUST_EXIST);
    }
    expect(signInLinkErrorMessage({ code: "user_not_found", status: 500 })).toBe(OWNER_MUST_EXIST);
  });

  it("maps an email provider or send failure, including 5xx, to the SMTP message", () => {
    expect(signInLinkErrorMessage({ code: "email_provider_disabled", status: 400 })).toBe(
      EMAIL_SEND_FAILED,
    );
    expect(signInLinkErrorMessage({ code: "unexpected_failure", status: 500 })).toBe(
      EMAIL_SEND_FAILED,
    );
    expect(signInLinkErrorMessage({ code: "unexpected_failure" })).toBe(EMAIL_SEND_FAILED);
    expect(signInLinkErrorMessage({ status: 500 })).toBe(EMAIL_SEND_FAILED);
    expect(signInLinkErrorMessage({ code: "hook_timeout", status: 503 })).toBe(EMAIL_SEND_FAILED);
    expect(signInLinkErrorMessage({ status: 599 })).toBe(EMAIL_SEND_FAILED);
  });

  it("uses a generic fallback that points at the redirect allow list and the Auth logs", () => {
    expect(signInLinkErrorMessage({ code: "validation_failed", status: 400 })).toBe(FALLBACK);
    expect(signInLinkErrorMessage({})).toBe(FALLBACK);
    expect(signInLinkErrorMessage({ code: null, status: null })).toBe(FALLBACK);
    expect(signInLinkErrorMessage({ code: "over_request_rate_limit", status: 400 })).toBe(
      FALLBACK,
    );
    expect(signInLinkErrorMessage({ status: 499 })).toBe(FALLBACK);
    expect(FALLBACK.endsWith("The Supabase Auth logs will show the exact reason.")).toBe(true);
  });

  it("keeps the redirect allow list hint out of the specific failure messages", () => {
    for (const message of [RATE_LIMIT, OWNER_MUST_EXIST, EMAIL_SEND_FAILED]) {
      expect(message).not.toMatch(/redirect allow list/i);
      expect(message).not.toMatch(/Supabase Auth logs/);
    }
    expect(FALLBACK).toMatch(/redirect allow list/);
  });
});
