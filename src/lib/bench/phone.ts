const PHONE_CHARS = /^[0-9+().\s-]+$/;
const MIN_DIGITS = 7;
const MAX_DIGITS = 15;
const MAX_RAW = 40;

export const PHONE_INVALID_MESSAGE =
  "Phone number looks wrong. Use 7 to 15 digits. Spaces, +, dashes and brackets are fine.";

function fail(): { ok: false; message: string } {
  return { ok: false, message: PHONE_INVALID_MESSAGE };
}

/**
 * Dial string for storage, tel: and sms:.
 * Strips spaces, dashes, dots and brackets, keeps one leading +, and drops a trunk 0 after +44.
 */
export function normalisePhone(value: string): string {
  const compact = value.trim().replace(/[\s().-]/g, "");
  const plus = compact.startsWith("+");
  let digits = compact.replace(/\D/g, "");
  if (plus && digits.startsWith("440")) digits = `44${digits.slice(3)}`;
  return plus ? `+${digits}` : digits;
}

/** Blank is allowed. A filled value needs 7 to 15 digits and no letters. */
export function parsePhone(value: string): { ok: true; phone: string | null } | { ok: false; message: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, phone: null };
  if (trimmed.length > MAX_RAW || !PHONE_CHARS.test(trimmed)) return fail();
  const plusAt = trimmed.indexOf("+");
  if (plusAt > 0 || (plusAt === 0 && trimmed.includes("+", 1))) return fail();
  const phone = normalisePhone(trimmed);
  const digits = phone.replace(/\D/g, "");
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS || !/^\+?\d+$/.test(phone)) return fail();
  return { ok: true, phone };
}

/** Same rules as the new-job form. Invalid text is not stored as a number. */
export function phoneForStorage(value: string | null | undefined): string | null {
  if (value == null) return null;
  const parsed = parsePhone(value);
  return parsed.ok ? parsed.phone : null;
}

/** Readable UK grouping for the job screen. Other lengths stay in the dial string. */
export function displayPhone(value: string): string {
  const parsed = parsePhone(value);
  const compact = parsed.ok && parsed.phone ? parsed.phone : value.trim();
  if (/^\+44\d{10}$/.test(compact)) {
    const rest = compact.slice(3);
    return `+44 ${rest.slice(0, 4)} ${rest.slice(4)}`;
  }
  if (/^0\d{10}$/.test(compact)) return `${compact.slice(0, 5)} ${compact.slice(5)}`;
  return compact;
}

export function telHref(phone: string): string | null {
  const parsed = parsePhone(phone);
  if (!parsed.ok || !parsed.phone) return null;
  return `tel:${parsed.phone}`;
}

export function smsHref(phone: string): string | null {
  const parsed = parsePhone(phone);
  if (!parsed.ok || !parsed.phone) return null;
  return `sms:${parsed.phone}`;
}
