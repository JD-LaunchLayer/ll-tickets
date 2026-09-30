import { readFileSync, readdirSync, statSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { autoStatusForNote, noteFiledNotice } from "@/lib/bench/auto-status";
import { addBenchNote } from "@/lib/bench/notes";
import { setBenchStatus } from "@/lib/bench/jobs";
import { saveAssistantFinding } from "@/lib/assistant/save-note";
import { JOB_STATUSES, STATUS_LABELS, type JobStatus } from "@/lib/jobs/domain";
import { MemoryJobRepository } from "@/lib/jobs/memory-repository";
import type { NewJob } from "@/lib/jobs/repository";

const NOW = new Date("2026-09-30T09:00:00.000Z");

function at(seconds: number): Date {
  return new Date(NOW.getTime() + seconds * 1000);
}

async function seed(repo: MemoryJobRepository, status: JobStatus = "new") {
  const input: NewJob = {
    customerName: "Ada Lovelace",
    deviceLabel: "HP Omen 25l",
    reportedFault: "No power",
    nextMove: "Diagnose the reported fault",
    priceGbp: null,
    priceBasis: null,
    priceAgreedAt: null,
    backupPosition: null,
    accessGiven: null,
    followUpAt: null,
    createdAt: NOW.toISOString(),
    phone: null,
  };
  const job = await repo.createJob(input);
  if (status !== "new") {
    const moved = await setBenchStatus(repo, job.ref, status, NOW);
    if (!moved.ok) throw new Error(moved.message);
    return moved.value;
  }
  return job;
}

describe("autoStatusForNote", () => {
  it("moves parts, done, quote agreed and a first finding, and nothing else", () => {
    const expected: Record<string, Partial<Record<JobStatus, JobStatus>>> = {
      parts: {
        new: "waiting_on_parts",
        diagnosing: "waiting_on_parts",
        waiting_on_customer: "waiting_on_parts",
      },
      work_done: {
        new: "waiting_on_customer",
        diagnosing: "waiting_on_customer",
        waiting_on_parts: "waiting_on_customer",
      },
      quote_auth: { waiting_on_customer: "diagnosing" },
      finding: { new: "diagnosing" },
    };
    const tags = [null, "", "finding", "work_done", "parts", "customer_contact", "quote_auth", "other", "nope"];
    for (const status of JOB_STATUSES) {
      for (const tag of tags) {
        const next = autoStatusForNote(tag, status);
        const wanted = tag ? expected[tag]?.[status] ?? null : null;
        expect(next, `${tag ?? "untagged"} from ${status}`).toBe(wanted);
      }
    }
  });

  it("names the new status and keeps a failed move visible", () => {
    expect(noteFiledNotice({ applied: true, from: "diagnosing", to: "waiting_on_parts" }, "Note filed.")).toEqual({
      notice: "Moved to Waiting on parts.",
      undoStatus: "diagnosing",
    });
    expect(noteFiledNotice({ applied: true, from: "waiting_on_customer", to: "diagnosing" }, "Note filed.").notice).toBe(
      `Moved to ${STATUS_LABELS.diagnosing}.`,
    );
    expect(noteFiledNotice({ applied: false }, "Note filed.")).toEqual({
      notice: "Note filed. Status did not change.",
      undoStatus: null,
    });
    expect(noteFiledNotice(null, "Note filed.")).toEqual({ notice: "Note filed.", undoStatus: null });
    expect(noteFiledNotice(null, "Saved to notes.").notice).toBe("Saved to notes.");
  });
});

describe("filing a note moves the status", () => {
  it("uses setBenchStatus, leaves the note filed when that fails, and a retry does not move twice", async () => {
    const repo = new MemoryJobRepository();
    const job = await seed(repo, "diagnosing");
    const filed = await addBenchNote(repo, {
      ref: job.ref,
      text: "Placeholder logic board - £239",
      tag: "parts",
      nextMove: null,
      clientRequestId: "bench-auto-1",
      now: at(5),
    });
    expect(filed.ok).toBe(true);
    if (!filed.ok) return;
    expect(filed.value.note.tag).toBe("parts");
    expect(filed.value.statusMove).toEqual({ applied: true, from: "diagnosing", to: "waiting_on_parts" });
    expect(filed.value.job.status).toBe("waiting_on_parts");
    expect(filed.value.job.nextMove).toBe("Diagnose the reported fault");

    const again = await addBenchNote(repo, {
      ref: job.ref,
      text: "Still waiting on that board.",
      tag: "parts",
      nextMove: null,
      clientRequestId: "bench-auto-2",
      now: at(15),
    });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.statusMove).toBeNull();
    expect(repo.jobs[0]?.status).toBe("waiting_on_parts");
    expect(repo.jobs[0]?.updatedAt).toBe(at(5).toISOString());

    const held = new MemoryJobRepository();
    const fresh = await seed(held, "new");
    held.updateJob = async () => {
      throw new Error("status write failed");
    };
    const kept = await addBenchNote(held, {
      ref: fresh.ref,
      text: "No light on the brick.",
      tag: "finding",
      nextMove: null,
      clientRequestId: "bench-auto-fail",
      now: at(20),
    });
    expect(kept.ok).toBe(true);
    if (!kept.ok) return;
    expect(kept.value.statusMove).toEqual({ applied: false });
    expect(kept.value.note.text).toContain("No light");
    expect(held.notes).toHaveLength(1);
    expect(held.jobs[0]?.status).toBe("new");
  });

  it("does not move ready, and quote agreed returns to diagnosing", async () => {
    const repo = new MemoryJobRepository();
    const ready = await seed(repo, "ready");
    const stayed = await addBenchNote(repo, {
      ref: ready.ref,
      text: "Board arrived.",
      tag: "parts",
      nextMove: null,
      clientRequestId: "bench-auto-ready",
      now: at(5),
    });
    expect(stayed.ok).toBe(true);
    if (!stayed.ok) return;
    expect(stayed.value.statusMove).toBeNull();
    expect(repo.jobs[0]?.status).toBe("ready");

    const waiting = new MemoryJobRepository();
    const job = await seed(waiting, "waiting_on_customer");
    const agreed = await addBenchNote(waiting, {
      ref: job.ref,
      text: "Customer said yes.",
      tag: "quote_auth",
      nextMove: null,
      clientRequestId: "bench-auto-quote",
      now: at(8),
    });
    expect(agreed.ok).toBe(true);
    if (!agreed.ok) return;
    expect(agreed.value.statusMove).toEqual({
      applied: true,
      from: "waiting_on_customer",
      to: "diagnosing",
    });
    expect(waiting.jobs[0]?.status).toBe("diagnosing");
  });

  it("moves a saved Ask finding, and the Action API path does not import the rule", async () => {
    const repo = new MemoryJobRepository();
    const job = await seed(repo, "new");
    const saved = await saveAssistantFinding(repo, {
      ref: job.ref,
      text: "No light on the charger brick.",
      tag: "finding",
      confirmed: true,
      clientRequestId: "asst-auto-1",
      now: at(4),
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.statusMove).toEqual({ applied: true, from: "new", to: "diagnosing" });
    expect(repo.jobs[0]?.status).toBe("diagnosing");

    const roots = ["src/lib/actions", "src/app/api"];
    const files = roots.flatMap((root) => walk(root));
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text.includes("auto-status"), file).toBe(false);
      expect(text.includes("autoStatusForNote"), file).toBe(false);
      expect(text.includes("addBenchNote"), file).toBe(false);
    }
    const record = readFileSync("src/lib/jobs/record.ts", "utf8");
    expect(record).not.toContain("autoStatusForNote");
    expect(record).not.toContain("setBenchStatus");
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}
