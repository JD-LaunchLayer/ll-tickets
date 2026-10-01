import { beforeEach, describe, expect, it } from "vitest";
import { resetRateLimit } from "@/lib/auth/rate-limit";
import type { CalendarEventInput, CalendarPort } from "@/lib/calendar/types";
import { handleAction, type ActionOperation, type ActionRuntime } from "@/lib/actions/handle";
import { collectKeys } from "@/lib/jobs/domain";
import { MemoryJobRepository } from "@/lib/jobs/memory-repository";
import { RepositoryError } from "@/lib/jobs/repository-error";

const API_KEY = "test-action-key-0123456789";
const PHONE = "07700900123";
const STORAGE_PATH = "jobs/private/hinge.jpg";
const NOW = "2026-09-29T09:00:00.000Z";

beforeEach(() => {
  resetRateLimit();
});

function fakeCalendar(configured = true) {
  const calls: CalendarEventInput[] = [];
  const deleted: string[] = [];
  const port: CalendarPort = {
    status: () => ({
      configured,
      missing: configured ? [] : ["GOOGLE_CALENDAR_ID", "GOOGLE_SERVICE_ACCOUNT_JSON"],
    }),
    async upsertPrivateEvent(input) {
      calls.push(input);
      if (input.eventId) return { eventId: input.eventId, action: "updated" };
      return { eventId: "evt_1", action: "created" };
    },
    async deleteEvent(eventId) {
      deleted.push(eventId);
    },
  };
  return { port, calls, deleted };
}

function runtimeFor(options?: {
  repo?: MemoryJobRepository;
  calendar?: CalendarPort;
  limit?: number;
  apiKey?: string;
  now?: () => Date;
}) {
  const repo = options?.repo ?? new MemoryJobRepository();
  const runtime: ActionRuntime = {
    repo,
    now: options?.now ?? (() => new Date(NOW)),
    calendar: options?.calendar ?? fakeCalendar().port,
    apiKey: options?.apiKey ?? API_KEY,
    configurationError: null,
    rateLimit: { limit: options?.limit ?? 500, windowMs: 60_000 },
  };
  return { repo, runtime };
}

function post(
  runtime: ActionRuntime,
  operation: ActionOperation,
  body: unknown,
  options?: { ip?: string; key?: string | null; path?: string },
) {
  const headers = new Headers({
    "content-type": "application/json",
    "x-forwarded-for": options?.ip ?? "203.0.113.10",
  });
  if (options?.key !== null) headers.set("authorization", `Bearer ${options?.key ?? API_KEY}`);
  return handleAction(
    new Request(`https://jobs.example${options?.path ?? "/"}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
    operation,
    runtime,
  );
}

function get(
  runtime: ActionRuntime,
  operation: ActionOperation,
  path: string,
  ref?: string,
) {
  return handleAction(
    new Request(`https://jobs.example${path}`, {
      headers: {
        authorization: `Bearer ${API_KEY}`,
        "x-forwarded-for": "203.0.113.10",
      },
    }),
    operation,
    runtime,
    ref ? { ref } : {},
  );
}

async function read(response: Response) {
  const text = await response.text();
  expect(text).not.toContain(PHONE);
  expect(text).not.toContain(STORAGE_PATH);
  expect(text.toLowerCase()).not.toContain("signed_url");
  expect(text.toLowerCase()).not.toContain("signedurl");
  const body = JSON.parse(text) as Record<string, unknown>;
  const keys = collectKeys(body);
  expect(keys.has("phone")).toBe(false);
  expect(keys.has("customer_name")).toBe(false);
  expect(keys.has("storage_path")).toBe(false);
  expect(keys.has("password")).toBe(false);
  return body;
}

const createBody = {
  client_request_id: "create-job-0001",
  device_label: "MacBook Pro 2019",
  reported_fault: "No power",
  next_move: "Check the charger",
};

describe("action API", () => {
  it("rejects a missing or wrong API key without echoing the key", async () => {
    const { runtime } = runtimeFor();
    const missing = await post(runtime, "create_job", createBody, { key: null });
    expect(missing.status).toBe(401);
    const missingBody = await read(missing);
    expect(missingBody).toMatchObject({ error: { code: "unauthorised" } });

    const wrongKey = "leaked-key-should-not-echo";
    const wrong = await post(runtime, "create_job", createBody, { key: wrongKey });
    expect(wrong.status).toBe(401);
    const text = JSON.stringify(await read(wrong));
    expect(text).not.toContain(wrongKey);
    expect(text).not.toContain(API_KEY);
  });

  it("validates creates, defaults an estimate, and records an agreed quote", async () => {
    const { runtime, repo } = runtimeFor();
    const missing = await post(runtime, "create_job", {
      client_request_id: "create-invalid-1",
      device_label: "MacBook Pro 2019",
    });
    expect(missing.status).toBe(400);
    expect(repo.jobs).toHaveLength(0);

    const unknown = await post(runtime, "create_job", { ...createBody, serial: "ABC" });
    expect(unknown.status).toBe(400);
    expect(JSON.stringify(await read(unknown))).toContain("Unknown field");

    const newline = await post(runtime, "create_job", {
      ...createBody,
      client_request_id: "create-newline-1",
      next_move: "Check\nthe charger",
    });
    expect(newline.status).toBe(400);

    const phone = await post(runtime, "create_job", { ...createBody, phone: PHONE });
    expect(phone.status).toBe(400);
    expect(await phone.text()).not.toContain(PHONE);
    expect(repo.jobs).toHaveLength(0);

    const password = await post(runtime, "create_job", {
      ...createBody,
      client_request_id: "create-password-1",
      password: "hunter2",
    });
    expect(password.status).toBe(400);
    expect(await password.text()).not.toContain("hunter2");

    const estimate = await post(runtime, "create_job", {
      ...createBody,
      client_request_id: "create-estimate-1",
      price_gbp: 49,
    });
    expect(estimate.status).toBe(200);
    const estimateBody = await read(estimate);
    expect(estimateBody).toMatchObject({
      device_label: "MacBook Pro 2019",
      price_gbp: 49,
      price_basis: "estimate",
      price_agreed_at: null,
      status: "new",
    });
    expect(estimateBody).not.toHaveProperty("customer_name");
    expect(estimateBody).not.toHaveProperty("phone");
    expect(repo.jobs[0]?.customerName).toBe("Not recorded");
    expect(repo.jobs[0]?.phone).toBeNull();
    expect(String(estimateBody.ref)).toMatch(/^LL-[A-Z2-9]{4}$/);

    const inconsistent = await post(runtime, "create_job", {
      ...createBody,
      client_request_id: "create-bad-quote-1",
      price_gbp: 80,
      price_basis: "estimate",
      price_agreed_at: NOW,
    });
    expect(inconsistent.status).toBe(400);

    const quote = await post(runtime, "create_job", {
      ...createBody,
      client_request_id: "create-quote-0001",
      device_label: "Dell Latitude",
      price_gbp: 120,
      price_basis: "quote",
    });
    const quoteBody = await read(quote);
    expect(quoteBody).toMatchObject({
      price_gbp: 120,
      price_basis: "quote",
      price_agreed_at: NOW,
    });
  });

  it("is idempotent and does not consume the id when validation fails", async () => {
    const { runtime, repo } = runtimeFor();
    const first = await post(runtime, "create_job", createBody);
    const second = await post(runtime, "create_job", createBody);
    const firstBody = await read(first);
    const secondBody = await read(second);
    expect(secondBody).toEqual(firstBody);
    expect(repo.jobs).toHaveLength(1);
    expect(repo.audits).toHaveLength(1);
    expect(repo.audits[0]).toMatchObject({
      operation: "create_job",
      clientRequestId: "create-job-0001",
    });

    const conflict = await post(runtime, "create_job", {
      ...createBody,
      device_label: "Someone Else",
    });
    expect(conflict.status).toBe(409);
    expect(repo.jobs).toHaveLength(1);
    expect(repo.audits).toHaveLength(1);

    const invalid = await post(runtime, "create_job", {
      client_request_id: "create-retry-0001",
      device_label: "ThinkPad",
    });
    expect(invalid.status).toBe(400);
    const retried = await post(runtime, "create_job", {
      client_request_id: "create-retry-0001",
      device_label: "ThinkPad",
      reported_fault: "Slow",
      next_move: "Run a diagnostic",
    });
    expect(retried.status).toBe(200);
    expect(repo.jobs).toHaveLength(2);
  });

  it("keeps the previous note text on edit and never returns a phone number", async () => {
    const calendar = fakeCalendar();
    let tick = 0;
    const start = new Date(NOW).getTime();
    const { runtime, repo } = runtimeFor({
      calendar: calendar.port,
      now: () => new Date(start + tick++ * 1000),
    });
    const created = await read(await post(runtime, "create_job", createBody));
    const ref = String(created.ref);
    const job = repo.jobs[0];
    if (!job) throw new Error("expected a job");
    repo.seedPhone(job.id, PHONE);
    repo.addPhoto({
      jobId: job.id,
      storagePath: STORAGE_PATH,
      caption: "Cracked hinge",
      takenAt: NOW,
    });

    const noted = await read(
      await post(runtime, "add_note", {
        client_request_id: "note-create-0001",
        ref,
        text: "Fan is seized and the serial is C02ABC123.",
        summary: "Fan seized",
        amount_gbp: 15,
        part_detail: "Fan assembly",
      }),
    );
    expect(noted).toMatchObject({
      ref,
      device_label: "MacBook Pro 2019",
    });
    expect(noted).not.toHaveProperty("customer_name");
    const note = noted.note as { id: string; tag: null };
    expect(note.tag).toBeNull();
    expect(repo.jobs[0]?.priceGbp).toBeNull();

    const again = await post(runtime, "add_note", {
      client_request_id: "note-create-0001",
      ref,
      text: "Fan is seized and the serial is C02ABC123.",
      summary: "Fan seized",
      amount_gbp: 15,
      part_detail: "Fan assembly",
    });
    expect(again.status).toBe(200);
    expect(repo.notes).toHaveLength(1);
    expect(repo.audits.filter((entry) => entry.operation === "add_note")).toHaveLength(1);

    const moved = await read(
      await post(runtime, "add_note", {
        client_request_id: "note-create-0002",
        ref,
        text: "Charger is fine. Serial C02ABC123 confirmed.",
        summary: "Charger is fine",
        tag: "finding",
        next_move: "Reseat the fan",
      }),
    );
    expect(moved).toMatchObject({ ref, device_label: "MacBook Pro 2019" });
    expect(moved).not.toHaveProperty("customer_name");
    expect(repo.jobs[0]?.nextMove).toBe("Reseat the fan");

    const edited = await read(
      await post(runtime, "edit_note", {
        client_request_id: "note-edit-000001",
        ref,
        note_id: note.id,
        text: "Fan is noisy, not seized. Serial C02ABC123.",
        summary: "Fan noisy",
      }),
    );
    expect(edited).toMatchObject({ ref, device_label: "MacBook Pro 2019" });
    expect(edited).not.toHaveProperty("customer_name");
    expect(repo.jobs[0]?.status).toBe("new");
    const revisions = await repo.listRevisions(note.id);
    expect(revisions.map((revision) => revision.text)).toContain(
      "Fan is seized and the serial is C02ABC123.",
    );
    expect(repo.notes.find((item) => item.id === note.id)?.text).toContain("noisy");
    expect(repo.notes.find((item) => item.id === note.id)?.editedAt).toEqual(expect.any(String));

    const detail = await read(await get(runtime, "get_job", `/api/actions/jobs/${ref}`, ref));
    expect(detail.photo_count).toBe(1);
    expect(detail.photo_captions).toEqual(["Cracked hinge"]);
    const notes = detail.notes as Array<{ summary: string }>;
    expect(notes.map((item) => item.summary)).toEqual(["Charger is fine", "Fan noisy"]);

    const found = await read(
      await get(runtime, "find_jobs", "/api/actions/jobs?device=macbook"),
    );
    const hits = found.jobs as Array<{ summary_line: string; ref: string }>;
    expect(hits).toHaveLength(1);
    expect(hits[0]?.ref).toBe(ref);
    expect(hits[0]?.summary_line).not.toContain("Ada Lovelace");
    expect(hits[0]?.summary_line).not.toContain("Not recorded");
    expect(hits[0]?.summary_line).toContain("MacBook Pro 2019");
    expect(hits[0]?.summary_line).toContain("Reseat the fan");
    expect(hits[0]?.summary_line).toContain("Charger is fine");

    const status = await read(
      await post(runtime, "set_status", {
        client_request_id: "status-diag-0001",
        ref,
        status: "diagnosing",
      }),
    );
    expect(status).toMatchObject({ ref, status: "diagnosing", closed_at: null });

    const collected = await read(
      await post(runtime, "set_status", {
        client_request_id: "status-done-0001",
        ref,
        status: "collected",
      }),
    );
    expect(collected).toMatchObject({ status: "collected" });
    expect(collected.closed_at).toEqual(expect.any(String));

    const active = await read(await get(runtime, "find_jobs", "/api/actions/jobs"));
    expect(active).toMatchObject({ filter: { status: "active" } });
    expect(active.jobs).toEqual([]);

    const collectedList = await read(
      await get(runtime, "find_jobs", "/api/actions/jobs?status=collected"),
    );
    expect(collectedList.jobs).toHaveLength(1);

    const reopened = await read(
      await post(runtime, "set_status", {
        client_request_id: "status-reopen-01",
        ref,
        status: "diagnosing",
      }),
    );
    expect(reopened).toMatchObject({ status: "diagnosing", closed_at: null });

    const booked = await read(
      await post(runtime, "create_collection_event", {
        client_request_id: "collect-00000001",
        ref,
        collection_at: "2026-10-02T16:00:00+01:00",
      }),
    );
    expect(booked).toMatchObject({
      ref,
      device_label: "MacBook Pro 2019",
      calendar: "created",
      calendar_event_id: "evt_1",
    });
    const movedCollection = await read(
      await post(runtime, "create_collection_event", {
        client_request_id: "collect-00000002",
        ref,
        collection_at: "2026-10-03T11:00:00+01:00",
      }),
    );
    expect(movedCollection).toMatchObject({ calendar: "updated", calendar_event_id: "evt_1" });
    expect(calendar.calls[1]?.eventId).toBe("evt_1");
    expect(calendar.calls[0]?.description).not.toContain(PHONE);
    expect(repo.audits.filter((entry) => entry.operation === "create_collection_event")).toHaveLength(2);

    const replay = await post(runtime, "create_collection_event", {
      client_request_id: "collect-00000002",
      ref,
      collection_at: "2026-10-03T11:00:00+01:00",
    });
    expect(replay.status).toBe(200);
    expect(calendar.calls).toHaveLength(2);
  });

  it("filters find_jobs by ref, device, and status", async () => {
    const { runtime } = runtimeFor();
    const first = await read(await post(runtime, "create_job", createBody));
    await post(runtime, "create_job", {
      ...createBody,
      client_request_id: "create-job-0002",
      device_label: "Custom tower",
      reported_fault: "No display",
      next_move: "Test the RAM",
    });
    await post(runtime, "set_status", {
      client_request_id: "status-close-000",
      ref: first.ref,
      status: "closed_no_repair",
    });

    const byDevice = await read(await get(runtime, "find_jobs", "/api/actions/jobs?device=tower"));
    expect(byDevice.jobs).toMatchObject([{ device_label: "Custom tower", status: "new" }]);
    expect(JSON.stringify(byDevice)).not.toContain("customer_name");

    const byRef = await read(
      await get(runtime, "find_jobs", `/api/actions/jobs?ref=${first.ref}&status=closed_no_repair`),
    );
    expect(byRef.jobs).toHaveLength(1);
    expect((byRef.jobs as Array<{ ref: string }>)[0]?.ref).toBe(first.ref);

    const refused = await get(runtime, "find_jobs", "/api/actions/jobs?customer_name=Ada");
    expect(refused.status).toBe(400);
    const refusedText = await refused.text();
    expect(refusedText).not.toContain("Ada");
    expect(refusedText).toContain("customer name");

    const badStatus = await get(runtime, "find_jobs", "/api/actions/jobs?status=open");
    expect(badStatus.status).toBe(400);
  });

  it("does not save a collection time when calendar is down, and retries after release", async () => {
    const { runtime, repo } = runtimeFor({ calendar: fakeCalendar(false).port });
    const created = await read(await post(runtime, "create_job", createBody));
    repo.seedPhone(repo.jobs[0]!.id, PHONE);
    const blocked = await post(runtime, "create_collection_event", {
      client_request_id: "collect-blocked-1",
      ref: created.ref,
      collection_at: "2026-10-02T16:00:00+01:00",
    });
    expect(blocked.status).toBe(503);
    expect(await blocked.text()).not.toContain(PHONE);
    expect(repo.jobs[0]?.collectionAt).toBeNull();
    expect(repo.audits.some((entry) => entry.operation === "create_collection_event")).toBe(false);

    let failed = false;
    const flaky = fakeCalendar();
    const original = flaky.port.upsertPrivateEvent.bind(flaky.port);
    flaky.port.upsertPrivateEvent = async (input) => {
      if (!failed) {
        failed = true;
        throw new Error("calendar down");
      }
      return original(input);
    };
    const retryRuntime = runtimeFor({ repo, calendar: flaky.port }).runtime;
    const first = await post(retryRuntime, "create_collection_event", {
      client_request_id: "collect-flaky-001",
      ref: created.ref,
      collection_at: "2026-10-02T16:00:00+01:00",
    });
    expect(first.status).toBe(502);
    const second = await post(retryRuntime, "create_collection_event", {
      client_request_id: "collect-flaky-001",
      ref: created.ref,
      collection_at: "2026-10-02T16:00:00+01:00",
    });
    expect(second.status).toBe(200);
    expect(repo.jobs[0]?.calendarEventId).toBe("evt_1");
  });

  it("removes a new calendar entry if the job row cannot be saved", async () => {
    const calendar = fakeCalendar();
    const repo = new MemoryJobRepository();
    const original = repo.updateJob.bind(repo);
    repo.updateJob = async (id, patch) => {
      if (patch.collectionAt) throw new Error("db down");
      return original(id, patch);
    };
    const { runtime } = runtimeFor({ repo, calendar: calendar.port });
    const created = await read(await post(runtime, "create_job", createBody));
    const response = await post(runtime, "create_collection_event", {
      client_request_id: "collect-db-fail-1",
      ref: created.ref,
      collection_at: "2026-10-02T16:00:00+01:00",
    });
    expect(response.status).toBe(500);
    expect(calendar.deleted).toEqual(["evt_1"]);
    expect(repo.jobs[0]?.collectionAt).toBeNull();
  });

  it("never puts a postgres code or message in an action error body", async () => {
    const leaked = {
      code: "42501",
      message: "permission denied for table jobs",
      details: "policy jobs_owner_select",
      hint: "Check private.is_owner",
    };
    const token = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signaturepart";
    const boom = () => {
      throw new RepositoryError("Could not create the job.", {
        ...leaked,
        message: `${leaked.message} ${token}`,
      });
    };

    async function assertNoPostgres(response: Response, body: unknown) {
      expect(response.status).toBe(500);
      const text = await response.text();
      expect(text).not.toContain(leaked.code);
      expect(text).not.toContain(leaked.message);
      expect(text).not.toContain(leaked.details);
      expect(text).not.toContain(leaked.hint);
      expect(text).not.toContain(token);
      expect(text).not.toContain("row-level security");
      expect(JSON.parse(text)).toEqual(body);
    }

    const repo = new MemoryJobRepository();
    repo.createJob = async () => boom();
    repo.findJobs = async () => boom();
    repo.getJobByRef = async () => boom();
    repo.addNote = async () => boom();
    repo.listNotes = async () => boom();
    repo.listPhotoCaptions = async () => boom();
    const { runtime } = runtimeFor({ repo });
    const generic = { error: { code: "internal_error", message: "The action failed." } };

    await assertNoPostgres(await post(runtime, "create_job", createBody), generic);
    await assertNoPostgres(await get(runtime, "find_jobs", "/api/actions/jobs"), generic);
    await assertNoPostgres(await get(runtime, "get_job", "/api/actions/jobs/LL-4K7M", "LL-4K7M"), generic);
    await assertNoPostgres(
      await post(runtime, "add_note", {
        client_request_id: "note-leak-0001",
        ref: "LL-4K7M",
        text: "Fan is noisy.",
        summary: "Fan is noisy",
      }),
      generic,
    );
    await assertNoPostgres(
      await post(runtime, "set_status", {
        client_request_id: "status-leak-0001",
        ref: "LL-4K7M",
        status: "diagnosing",
      }),
      generic,
    );

    const live = new MemoryJobRepository();
    const { runtime: liveRuntime } = runtimeFor({ repo: live, calendar: fakeCalendar().port });
    const created = await read(
      await post(liveRuntime, "create_job", { ...createBody, client_request_id: "create-for-leak" }),
    );
    live.updateJob = async () => boom();
    await assertNoPostgres(
      await post(liveRuntime, "set_status", {
        client_request_id: "status-leak-0002",
        ref: created.ref,
        status: "diagnosing",
      }),
      generic,
    );
    await assertNoPostgres(
      await post(liveRuntime, "create_collection_event", {
        client_request_id: "collect-leak-0001",
        ref: created.ref,
        collection_at: "2026-10-02T16:00:00+01:00",
      }),
      {
        ref: created.ref,
        device_label: "MacBook Pro 2019",
        error: { code: "internal_error", message: "The collection time could not be saved." },
      },
    );
  });

  it("rate limits a noisy client", async () => {
    const { runtime } = runtimeFor({ limit: 2 });
    const ip = "198.51.100.20";
    const first = await getWithIp(runtime, ip);
    const second = await getWithIp(runtime, ip);
    const third = await getWithIp(runtime, ip);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(third.status).toBe(429);
    expect(third.headers.get("retry-after")).toBeTruthy();
  });
});

function getWithIp(runtime: ActionRuntime, ip: string) {
  return handleAction(
    new Request("https://jobs.example/api/actions/jobs", {
      headers: { authorization: `Bearer ${API_KEY}`, "x-forwarded-for": ip },
    }),
    "find_jobs",
    runtime,
  );
}
