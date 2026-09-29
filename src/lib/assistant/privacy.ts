const SECRET_KEY = /phone|mobile|password|passwd|passphrase|\bpin\b/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function patternsFor(secret: string): RegExp[] {
  const exact = secret.trim();
  const patterns: RegExp[] = [];
  if (exact.length >= 6) patterns.push(new RegExp(escapeRegExp(exact), "gi"));
  const digits = exact.replace(/\D/g, "");
  if (digits.length >= 7) {
    const body = digits.split("").join("[\\s().-]*");
    patterns.push(new RegExp(`(?<!\\d)${body}(?!\\d)`, "g"));
  }
  return patterns;
}

function redact(value: string, patterns: RegExp[]): string {
  let next = value;
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    next = next.replace(pattern, "[omitted]");
  }
  return next;
}

/** Drop phone and password fields, and blank out known customer numbers. */
export function stripForModel(value: unknown, secrets: readonly string[]): unknown {
  const patterns = secrets.flatMap((secret) => patternsFor(secret));
  return walk(value, patterns);
}

function walk(value: unknown, patterns: RegExp[]): unknown {
  if (typeof value === "string") return redact(value, patterns);
  if (typeof value !== "object" || value === null) return value;
  if (Array.isArray(value)) return value.map((item) => walk(item, patterns));
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (SECRET_KEY.test(key)) continue;
    out[key] = walk(nested, patterns);
  }
  return out;
}
