import { describe, expect, it } from "vitest";
import { saveAssistantFinding } from "@/lib/assistant/save-note";
import { addBenchNote } from "@/lib/bench/notes";
import { MemoryJobRepository } from "@/lib/jobs/memory-repository";
import type { NewJob } from "@/lib/jobs/repository";

const NOW = new Date("2026-09-29T09:00:00.000Z");
const NAME = "Ada Lovelace";

async function job() {
  const repo = new MemoryJobRepository();
  const created = await repo.createJob({
    customerName: NAME,
    deviceLabel: "ThinkPad T14",
    reportedFault: "No power",
    nextMove: "Check the charger",
    priceGbp: null,
    priceBasis: null,
    priceAgreedAt: null,
    backupPosition: null,
    accessGiven: null,
    followUpAt: null,
    createdAt: NOW.toISOString(),
    phone: "07700900123",
  } satisfies NewJob);
  return { repo, created };
}

describe("where a customer name may be stored", () => {
  it("scrubs Ask save-to-notes and leaves a note typed in the app unchanged", async () => {
    const { repo, created } = await job();
    const typed = await addBenchNote(repo, {
      ref: created.ref,
      text: "Ada Lovelace will collect it tomorrow.",
      tag: "other",
      nextMove: null,
      clientRequestId: "bench-typed-note-01",
      now: NOW,
    });
    expect(typed.ok).toBe(true);
    expect(repo.notes[0]?.text).toBe("Ada Lovelace will collect it tomorrow.");
    expect(repo.jobs[0]?.status).toBe("new");

    const saved = await saveAssistantFinding(repo, {
      ref: created.ref,
      text: "Ada Lovelace says the jack is loose.",
      tag: "other",
      confirmed: true,
      clientRequestId: "asst-scrub-note-01",
      now: NOW,
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.nameReplaced).toBe(true);
    expect(saved.value.note.text).toBe("the customer says the jack is loose.");
    expect(saved.value.job.status).toBe("new");
    expect(repo.notes.find((note) => note.text.includes(NAME))?.text).toBe(
      "Ada Lovelace will collect it tomorrow.",
    );
  });
});
