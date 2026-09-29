import { createHash, timingSafeEqual } from "crypto";

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(\S+)\s*$/i);
  return match?.[1] ?? null;
}

/** SHA-256 both sides so a length mismatch still takes constant time. */
export function bearerMatches(header: string | null, expected: string): boolean {
  const presented = bearerToken(header);
  if (!presented || !expected) return false;
  const left = createHash("sha256").update(presented).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}
