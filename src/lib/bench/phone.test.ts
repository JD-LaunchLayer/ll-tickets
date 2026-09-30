import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { createBenchJob } from "@/lib/bench/jobs";
import {
  displayPhone,
  parsePhone,
  phoneForStorage,
  PHONE_INVALID_MESSAGE,
  smsHref,
  telHref,
} from "@/lib/bench/phone";
import { MemoryJobRepository } from "@/lib/jobs/memory-repository";

const NOW = new Date("2026-09-29T09:00:00.000Z");

const UK = [
  { input: "07708 268607", stored: "07708268607", display: "07708 268607" },
  { input: "+44 7708 268607", stored: "+447708268607", display: "+44 7708 268607" },
  { input: "+44 (0)7708 268607", stored: "+447708268607", display: "+44 7708 268607" },
  { input: "07708-268-607", stored: "07708268607", display: "07708 268607" },
  { input: "07708.268.607", stored: "07708268607", display: "07708 268607" },
  { input: "(01268) 123456", stored: "01268123456", display: "01268 123456" },
  { input: "01268 123 456", stored: "01268123456", display: "01268 123456" },
] as const;

describe("phone validation", () => {
  it("accepts normal UK formats and stores a dial string", () => {
    for (const sample of UK) {
      const parsed = parsePhone(sample.input);
      expect(parsed, sample.input).toEqual({ ok: true, phone: sample.stored });
      expect(displayPhone(sample.stored), sample.input).toBe(sample.display);
      expect(telHref(sample.input), sample.input).toBe(`tel:${sample.stored}`);
      expect(smsHref(sample.input), sample.input).toBe(`sms:${sample.stored}`);
      expect(telHref(sample.stored)).toBe(`tel:${sample.stored}`);
      expect(smsHref(sample.stored)).toBe(`sms:${sample.stored}`);
    }
  });

  it("accepts an empty optional phone and rejects letters, short and long values", () => {
    expect(parsePhone("")).toEqual({ ok: true, phone: null });
    expect(parsePhone("   ")).toEqual({ ok: true, phone: null });
    expect(phoneForStorage(null)).toBeNull();
    expect(phoneForStorage("")).toBeNull();
    expect(phoneForStorage("   ")).toBeNull();

    const rejected = [
      "call me",
      "07708 268607a",
      "07708 ext 12",
      "123456",
      "12345",
      "1234567890123456",
      "+1234567890123456",
      "+",
      "++447708268607",
      "44+7708268607",
      "javascript:alert(1)",
      "07708/268607",
    ];
    for (const value of rejected) {
      const parsed = parsePhone(value);
      expect(parsed.ok, value).toBe(false);
      if (!parsed.ok) expect(parsed.message).toBe(PHONE_INVALID_MESSAGE);
      expect(telHref(value), value).toBeNull();
      expect(smsHref(value), value).toBeNull();
      expect(phoneForStorage(value), value).toBeNull();
    }
    expect(parsePhone("1234567")).toEqual({ ok: true, phone: "1234567" });
    expect(parsePhone("123456789012345")).toEqual({ ok: true, phone: "123456789012345" });
  });

  it("stores the dial string from the new-job path and keeps the number off the action API", async () => {
    const repo = new MemoryJobRepository();
    const created = await createBenchJob(repo, {
      customerName: "Jordan",
      deviceLabel: "iPhone",
      reportedFault: "No signal",
      phone: "+44 (0)7708 268607",
      now: NOW,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.phone).toBe("+447708268607");
    expect(displayPhone(created.value.phone ?? "")).toBe("+44 7708 268607");
    expect(telHref(created.value.phone ?? "")).toBe("tel:+447708268607");
    expect(smsHref(created.value.phone ?? "")).toBe("sms:+447708268607");

    const direct = new MemoryJobRepository();
    const job = await direct.createJob({
      customerName: "Jordan",
      deviceLabel: "iPhone",
      reportedFault: "No signal",
      nextMove: "Call them",
      priceGbp: null,
      priceBasis: null,
      priceAgreedAt: null,
      backupPosition: null,
      accessGiven: null,
      followUpAt: null,
      createdAt: NOW.toISOString(),
      phone: "07708 268607",
    });
    expect(job.phone).toBe("07708268607");

    const handle = readFileSync("src/lib/actions/handle.ts", "utf8");
    const validate = readFileSync("src/lib/jobs/validate.ts", "utf8");
    const tools = readFileSync("src/lib/assistant/tools.ts", "utf8");
    const supabase = readFileSync("src/lib/jobs/supabase-repository.ts", "utf8");
    expect(handle).toContain("phone: null");
    expect(validate).toContain("The Action API never accepts a phone number");
    expect(tools).not.toMatch(/phone:\s*z\./);
    expect(supabase).toContain("phoneForStorage");
  });
});
