/** Crockford-style, without I, L, O, 0 and 1. Keep in step with public.generate_job_ref. */
export const JOB_REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const REF_PATTERN = /^LL-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;

export function generateJobRef(random: () => number = Math.random): string {
  let ref = "LL-";
  for (let index = 0; index < 4; index += 1) {
    const pick = Math.floor(random() * JOB_REF_ALPHABET.length) % JOB_REF_ALPHABET.length;
    ref += JOB_REF_ALPHABET[pick];
  }
  return ref;
}

export function canonicalJobRef(value: string): string | null {
  const ref = value.trim().toUpperCase();
  return REF_PATTERN.test(ref) ? ref : null;
}
