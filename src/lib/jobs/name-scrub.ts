import { stripForModel } from "@/lib/assistant/privacy";
import { UNRECORDED_CUSTOMER } from "@/lib/jobs/domain";

export const NAME_REPLACED_MESSAGE = 'Replaced the customer name with "the customer".';

const REPLACEMENT = "the customer";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replaces the job's own stored customer name, case-insensitive, as a whole word.
 * "Ann" does not match "Anne" or "Annual". This is not name detection.
 */
export function scrubStoredCustomerName(
  text: string,
  customerName: string,
): { text: string; replaced: boolean } {
  const name = customerName.trim();
  if (!name || name === UNRECORDED_CUSTOMER) return { text, replaced: false };
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(name)}(?![\\p{L}\\p{N}])`, "giu");
  let replaced = false;
  const next = text.replace(pattern, () => {
    replaced = true;
    return REPLACEMENT;
  });
  return { text: next, replaced };
}

export function scrubNoteCopy(
  fields: { text?: string; summary?: string; partDetail?: string | null },
  customerName: string,
): { text?: string; summary?: string; partDetail?: string | null; replaced: boolean } {
  let replaced = false;
  const out: { text?: string; summary?: string; partDetail?: string | null; replaced: boolean } = {
    replaced: false,
  };
  if (fields.text !== undefined) {
    const result = scrubStoredCustomerName(fields.text, customerName);
    out.text = result.text;
    replaced = replaced || result.replaced;
  }
  if (fields.summary !== undefined) {
    const result = scrubStoredCustomerName(fields.summary, customerName);
    out.summary = result.text;
    replaced = replaced || result.replaced;
  }
  if (fields.partDetail !== undefined) {
    if (fields.partDetail === null) {
      out.partDetail = null;
    } else {
      const result = scrubStoredCustomerName(fields.partDetail, customerName);
      out.partDetail = result.text;
      replaced = replaced || result.replaced;
    }
  }
  out.replaced = replaced;
  return out;
}

function hideName(value: unknown, customerName: string): unknown {
  const name = customerName.trim();
  if (!name || name === UNRECORDED_CUSTOMER) return value;
  return walk(value, name);
}

function walk(value: unknown, customerName: string): unknown {
  if (typeof value === "string") return scrubStoredCustomerName(value, customerName).text;
  if (Array.isArray(value)) return value.map((item) => walk(item, customerName));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = walk(nested, customerName);
    }
    return out;
  }
  return value;
}

/** Response copy for the GPT or Ask. Stored notes are left as they are. */
export function presentAction(
  job: { customerName: string; phone: string | null },
  body: unknown,
): unknown {
  const hidden = hideName(body, job.customerName);
  return stripForModel(hidden, job.phone ? [job.phone] : []);
}
