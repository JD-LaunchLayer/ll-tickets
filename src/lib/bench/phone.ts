const PHONE_CHARS = /^[0-9+().\-\s]{6,30}$/;

/** Blank is allowed. A filled value must look like a phone number. */
export function parsePhone(value: string): { ok: true; phone: string | null } | { ok: false; message: string } {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return { ok: true, phone: null };
  const digits = trimmed.replace(/\D/g, "");
  if (!PHONE_CHARS.test(trimmed) || digits.length < 7 || digits.length > 15) {
    return {
      ok: false,
      message: "Phone number looks wrong. Use digits, for example 07700 900123.",
    };
  }
  return { ok: true, phone: trimmed };
}

/** Digits only, optional leading +. Unusable values do not become a link. */
export function telHref(phone: string): string | null {
  const compact = phone.replace(/[^\d+]/g, "");
  if (!/^\+?\d{7,15}$/.test(compact)) return null;
  return `tel:${compact}`;
}
