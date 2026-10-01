import { readFileSync } from "fs";
import { beforeEach, describe, expect, it } from "vitest";
import { handleAction, type ActionRuntime } from "@/lib/actions/handle";
import { WORKSHOP_RECORD_INSTRUCTIONS } from "@/lib/assistant/instructions";
import { buildSystemPrompt } from "@/lib/assistant/prompt";
import { emptyListMessage } from "@/lib/bench/filters";
import { resetRateLimit } from "@/lib/auth/rate-limit";
import { STATUS_LABELS } from "@/lib/jobs/domain";
import { NAME_REPLACED_MESSAGE, scrubStoredCustomerName } from "@/lib/jobs/name-scrub";
import { MemoryJobRepository } from "@/lib/jobs/memory-repository";
import { FIND_LIMIT, type NewJob } from "@/lib/jobs/repository";

const API_KEY = "test-action-key-0123456789";
const PHONE = "07700900123";
const NAME = "Ada Lovelace";
const NOW = "2026-09-29T09:00:00.000Z";

beforeEach(() => {
  resetRateLimit();
});

function runtimeFor(repo = new MemoryJobRepository()): { repo: MemoryJobRepository; runtime: ActionRuntime } {
  const runtime: ActionRuntime = {
    repo,
    now: () => new Date(NOW),
    calendar: {
      status: () => ({ configured: true, missing: [] }),
      async upsertPrivateEvent(input) {
        return { eventId: input.eventId ?? "evt_1", action: input.eventId ? "updated" : "created" };
      },
      async deleteEvent() {
        return undefined;
      },
    },
    apiKey: API_KEY,
    configurationError: null,
    rateLimit: { limit: 500, windowMs: 60_000 },
  };
  return { repo, runtime };
}

function post(runtime: ActionRuntime, operation: Parameters<typeof handleAction>[1], body: unknown) {
  return handleAction(
    new Request("https://jobs.example/api/actions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${API_KEY}`,
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.40",
      },
      body: JSON.stringify(body),
    }),
    operation,
    runtime,
  );
}

function get(runtime: ActionRuntime, path: string, ref?: string) {
  return handleAction(
    new Request(`https://jobs.example${path}`, {
      headers: { authorization: `Bearer ${API_KEY}`, "x-forwarded-for": "203.0.113.40" },
    }),
    path.includes("/api/actions/jobs/") ? "get_job" : "find_jobs",
    runtime,
    ref ? { ref } : {},
  );
}

function jobInput(over: Partial<NewJob> = {}): NewJob {
  return {
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
    createdAt: NOW,
    phone: PHONE,
    ...over,
  };
}

describe("customer identity stays out of the action API", () => {
  it("refuses a customer name or a phone number and does not store either", async () => {
    const { runtime, repo } = runtimeFor();
    const named = await post(runtime, "create_job", {
      client_request_id: "create-named-0001",
      customer_name: NAME,
      device_label: "ThinkPad T14",
      reported_fault: "No power",
      next_move: "Check the charger",
    });
    expect(named.status).toBe(400);
    const namedText = await named.text();
    expect(namedText).not.toContain(NAME);
    expect(namedText).toContain("customer name");
    expect(repo.jobs).toHaveLength(0);

    const phone = await post(runtime, "create_job", {
      client_request_id: "create-phone-0001",
      phone: PHONE,
      device_label: "ThinkPad T14",
      reported_fault: "No power",
      next_move: "Check the charger",
    });
    expect(phone.status).toBe(400);
    expect(await phone.text()).not.toContain(PHONE);
    expect(repo.jobs).toHaveLength(0);

    const created = await post(runtime, "create_job", {
      client_request_id: "create-clean-0001",
      device_label: "ThinkPad T14",
      reported_fault: "No power",
      next_move: "Check the charger",
    });
    expect(created.status).toBe(200);
    const body = await created.text();
    expect(body).not.toContain(NAME);
    expect(body).not.toContain(PHONE);
    expect(body).not.toContain("customer_name");
    expect(repo.jobs[0]?.customerName).toBe("Not recorded");
    expect(repo.jobs[0]?.phone).toBeNull();
    expect(repo.jobs[0]?.deviceLabel).toBe("ThinkPad T14");
    expect(repo.jobs[0]?.reportedFault).toBe("No power");
  });

  it("does not match a customer name, and does match device, symptom, and notes", async () => {
    const { runtime, repo } = runtimeFor();
    const named = await repo.createJob(jobInput());
    await repo.addNote({
      jobId: named.id,
      text: "Reseated the fan connector.",
      summary: "Reseated the fan",
      tag: "finding",
      amountGbp: null,
      partDetail: null,
      createdAt: NOW,
      clientRequestId: "privacy-note-0001",
    });
    const other = await repo.createJob(
      jobInput({
        customerName: "Grace Hopper",
        deviceLabel: "Custom tower",
        reportedFault: "No display",
        phone: null,
      }),
    );

    const byName = await get(runtime, "/api/actions/jobs?device=Lovelace");
    expect(byName.status).toBe(200);
    const byNameBody = (await byName.json()) as { jobs: unknown[] };
    expect(byNameBody.jobs).toEqual([]);

    const refused = await get(runtime, "/api/actions/jobs?customer_name=Ada");
    expect(refused.status).toBe(400);
    expect(await refused.text()).not.toContain(NAME);

    const byDevice = (await (await get(runtime, "/api/actions/jobs?device=thinkpad")).json()) as {
      jobs: Array<{ ref: string }>;
    };
    expect(byDevice.jobs.map((job) => job.ref)).toEqual([named.ref]);

    const bySymptom = (await (await get(runtime, "/api/actions/jobs?device=display")).json()) as {
      jobs: Array<{ ref: string }>;
    };
    expect(bySymptom.jobs.map((job) => job.ref)).toEqual([other.ref]);

    const byNote = (await (await get(runtime, "/api/actions/jobs?device=connector")).json()) as {
      jobs: Array<{ ref: string }>;
    };
    expect(byNote.jobs.map((job) => job.ref)).toEqual([named.ref]);
    expect(JSON.stringify(byDevice)).not.toContain(NAME);
    expect(JSON.stringify(byDevice)).not.toContain(PHONE);
    expect(JSON.stringify(byNote)).not.toContain(NAME);
  });

  it("lists open jobs with no query, newest first, and caps the list", async () => {
    const { runtime, repo } = runtimeFor();
    const refs: string[] = [];
    for (let index = 0; index < FIND_LIMIT + 1; index += 1) {
      const job = await repo.createJob(
        jobInput({
          customerName: `Person ${index}`,
          deviceLabel: `Device ${index}`,
          phone: null,
          createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
        }),
      );
      refs.push(job.ref);
    }
    const response = await get(runtime, "/api/actions/jobs");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { filter: { status: string }; jobs: Array<{ ref: string }> };
    expect(body.filter.status).toBe("active");
    expect(body.jobs).toHaveLength(FIND_LIMIT);
    expect(body.jobs[0]?.ref).toBe(refs[refs.length - 1]);
    expect(body.jobs.map((job) => job.ref)).not.toContain(refs[0]);
    const text = JSON.stringify(body);
    expect(text).not.toContain("Person");
    expect(text).not.toContain("customer_name");
  });
});

describe("name scrub", () => {
  it("replaces the stored name, whole word and case-insensitive, and ignores substrings", () => {
    expect(scrubStoredCustomerName("Spoke to Ada Lovelace today.", NAME)).toEqual({
      text: "Spoke to the customer today.",
      replaced: true,
    });
    expect(scrubStoredCustomerName("ADA LOVELACE called.", NAME).text).toBe("the customer called.");
    expect(scrubStoredCustomerName("ada lovelace, please.", NAME).text).toBe("the customer, please.");
    expect(scrubStoredCustomerName("The Annual service. Joanne called Anne.", "Ann")).toEqual({
      text: "The Annual service. Joanne called Anne.",
      replaced: false,
    });
    expect(scrubStoredCustomerName("ann left the machine.", "Ann").text).toBe("the customer left the machine.");
    expect(scrubStoredCustomerName("MacAda is a different word.", "Ada").replaced).toBe(false);
  });

  it("scrubs a GPT note and an edit, and the edit does not change status", async () => {
    const { runtime, repo } = runtimeFor();
    const job = await repo.createJob(jobInput());
    const moved = await post(runtime, "set_status", {
      client_request_id: "privacy-status-01",
      ref: job.ref,
      status: "diagnosing",
    });
    expect(moved.status).toBe(200);
    expect(await moved.text()).not.toContain(NAME);

    const noted = await post(runtime, "add_note", {
      client_request_id: "privacy-note-0002",
      ref: job.ref,
      text: "Spoke to Ada Lovelace about the fan.",
      summary: "Ada Lovelace called",
      part_detail: "Ada Lovelace's fan",
    });
    expect(noted.status).toBe(200);
    const notedBody = (await noted.json()) as { notice?: string; note: { id: string; text: string; summary: string; part_detail: string } };
    expect(notedBody.notice).toBe(NAME_REPLACED_MESSAGE);
    expect(notedBody.note.text).toBe("Spoke to the customer about the fan.");
    expect(notedBody.note.summary).toBe("the customer called");
    expect(notedBody.note.part_detail).toBe("the customer's fan");
    expect(JSON.stringify(notedBody)).not.toContain(NAME);
    expect(repo.notes[0]?.text).toBe("Spoke to the customer about the fan.");
    expect(repo.jobs[0]?.status).toBe("diagnosing");

    const edited = await post(runtime, "edit_note", {
      client_request_id: "privacy-edit-0001",
      ref: job.ref,
      note_id: notedBody.note.id,
      text: "ADA LOVELACE confirmed the quote.",
      tag: "parts",
    });
    expect(edited.status).toBe(200);
    const editedBody = (await edited.json()) as { notice?: string; note: { id: string; text: string; tag: string } };
    expect(editedBody.notice).toBe(NAME_REPLACED_MESSAGE);
    expect(editedBody.note.text).toBe("the customer confirmed the quote.");
    expect(editedBody.note.tag).toBe("parts");
    expect(editedBody.note.id).toBe(notedBody.note.id);
    expect(repo.jobs[0]?.status).toBe("diagnosing");
    expect(JSON.stringify(editedBody)).not.toContain(NAME);

    const detail = await get(runtime, `/api/actions/jobs/${job.ref}`, job.ref);
    const detailBody = (await detail.json()) as { notes: Array<{ id: string; text: string }> };
    expect(detailBody.notes[0]?.id).toBe(notedBody.note.id);
    expect(detailBody.notes[0]?.text).toBe("the customer confirmed the quote.");
    expect(JSON.stringify(detailBody)).not.toContain(NAME);
    expect(JSON.stringify(detailBody)).not.toContain(PHONE);
  });

  it("hides a name on read, and leaves a note typed in the app unchanged", async () => {
    const { runtime, repo } = runtimeFor();
    const job = await repo.createJob(jobInput({ phone: PHONE }));
    await repo.addNote({
      jobId: job.id,
      text: "Ada Lovelace will collect it tomorrow.",
      summary: "Collection tomorrow",
      tag: "other",
      amountGbp: null,
      partDetail: null,
      createdAt: NOW,
      clientRequestId: "bench-typed-note-1",
    });
    expect(repo.notes[0]?.text).toBe("Ada Lovelace will collect it tomorrow.");

    const detail = await get(runtime, `/api/actions/jobs/${job.ref}`, job.ref);
    const text = await detail.text();
    expect(text).not.toContain(NAME);
    expect(text).not.toContain(PHONE);
    expect(text).toContain("the customer will collect it tomorrow.");
    expect(repo.notes[0]?.text).toBe("Ada Lovelace will collect it tomorrow.");
  });
});

describe("ready to collect", () => {
  it("uses that label and lets the GPT set the ready status", async () => {
    expect(STATUS_LABELS.ready).toBe("Ready to collect");
    expect(emptyListMessage("ready")).toBe("No jobs ready to collect.");
    expect(readFileSync("src/app/page.tsx", "utf8")).toContain("STATUS_LABELS.ready");
    expect(readFileSync("src/app/bench/where-at.tsx", "utf8")).toContain("STATUS_LABELS");

    const { runtime, repo } = runtimeFor();
    const job = await repo.createJob(jobInput({ phone: null }));
    const ready = await post(runtime, "set_status", {
      client_request_id: "privacy-ready-001",
      ref: job.ref,
      status: "ready",
    });
    expect(ready.status).toBe(200);
    const body = (await ready.json()) as { status: string };
    expect(body.status).toBe("ready");
    expect(repo.jobs[0]?.status).toBe("ready");
    expect(JSON.stringify(body)).not.toContain(NAME);

    const prompt = buildSystemPrompt({
      ref: job.ref,
      customerName: NAME,
      deviceLabel: job.deviceLabel,
      reportedFault: "No power",
      status: "ready",
      nextMove: "Hand it over",
      priceGbp: null,
      priceBasis: null,
      priceAgreedAt: null,
      notes: [{ tag: "other", text: "Ada Lovelace will collect it." }],
    });
    expect(prompt).toContain("Status: ready (Ready to collect)");
    expect(prompt).toContain("the customer will collect it.");
    expect(prompt).not.toContain(NAME);
    expect(prompt).toContain('use "the customer"');
  });
});

describe("GPT fence", () => {
  it("matches the instructions module and tells the GPT how to handle names, notes, and ready", () => {
    const markdown = readFileSync("docs/gpt-instructions.md", "utf8");
    const fenced = markdown.match(/```\n([\s\S]*?)\n```/);
    expect(fenced?.[1]).toBe(WORKSHOP_RECORD_INSTRUCTIONS);
    expect(WORKSHOP_RECORD_INSTRUCTIONS).toContain("Ready to collect");
    expect(WORKSHOP_RECORD_INSTRUCTIONS).toContain('replace it with "the customer"');
    expect(WORKSHOP_RECORD_INSTRUCTIONS).toContain("edit_note does not change status");
    expect(WORKSHOP_RECORD_INSTRUCTIONS).toContain("Never ask for a customer name or a phone number.");
    expect(WORKSHOP_RECORD_INSTRUCTIONS).not.toContain("the customer name, and the device");
  });
});
