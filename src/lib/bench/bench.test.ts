import { readFileSync } from "fs";
import { beforeEach, describe, expect, it } from "vitest";
import { handleAction, type ActionRuntime } from "@/lib/actions/handle";
import { resetRateLimit } from "@/lib/auth/rate-limit";
import { isPublicPath } from "@/lib/auth/public-paths";
import { formatBenchTime } from "@/lib/bench/format";
import { createBenchJob, listBenchJobs, loadBenchJob, saveBenchNextMove, setBenchStatus } from "@/lib/bench/jobs";
import { addBenchNote, summaryFromNoteText } from "@/lib/bench/notes";
import { parsePhone, telHref } from "@/lib/bench/phone";
import type { CalendarPort } from "@/lib/calendar/types";
import { collectKeys, toPublicJob } from "@/lib/jobs/domain";
import { MemoryJobRepository } from "@/lib/jobs/memory-repository";
import { PHOTO_JPEG_QUALITY, PHOTO_MAX_EDGE, fittedSize } from "@/lib/photos/fit";
import { isJpeg, jobPhotoPath } from "@/lib/photos/path";
import { createPrivatePhotoUrl, JOB_PHOTOS_BUCKET, PHOTO_SIGNED_URL_SECONDS } from "@/lib/photos/signed-url";
import { signJobPhotos } from "@/lib/photos/views";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const PHONE = "07700900999";
const NOW = new Date("2026-09-29T09:00:00.000Z");
const API_KEY = "test-action-key-0123456789";

beforeEach(() => {
  resetRateLimit();
});

function at(seconds: number): Date {
  return new Date(NOW.getTime() + seconds * 1000);
}

async function benchJob(
  repo: MemoryJobRepository,
  input: { customerName: string; deviceLabel: string; reportedFault?: string; phone?: string; now?: Date },
) {
  const result = await createBenchJob(repo, {
    customerName: input.customerName,
    deviceLabel: input.deviceLabel,
    reportedFault: input.reportedFault ?? "No power",
    phone: input.phone ?? "",
    now: input.now ?? NOW,
  });
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

describe("bench notes", () => {
  it("files a tagged note through the add_note parser and can set the next move", async () => {
    const repo = new MemoryJobRepository();
    const job = await benchJob(repo, { customerName: "Ada Lovelace", deviceLabel: "MacBook Pro 2019" });
    const long = `${"Fan seized. ".repeat(20)}Serial is fine.`;
    expect(summaryFromNoteText("a".repeat(150))).toBe(`${"a".repeat(89)}…`);
    expect(summaryFromNoteText("a".repeat(150)).length).toBeLessThanOrEqual(120);
    expect(summaryFromNoteText(long)).not.toContain("\n");
    expect(summaryFromNoteText(long).length).toBeLessThanOrEqual(120);

    const filed = await addBenchNote(repo, {
      ref: job.ref,
      text: long,
      tag: "finding",
      nextMove: "Order a fan",
      clientRequestId: "bench-note-0001",
      now: at(10),
    });
    expect(filed.ok).toBe(true);
    if (!filed.ok) return;
    expect(filed.value.note.tag).toBe("finding");
    expect(filed.value.note.summary).toBe(summaryFromNoteText(long));
    expect(filed.value.note.text).toBe(long.trim());
    expect(filed.value.job.nextMove).toBe("Order a fan");
    expect(repo.notes).toHaveLength(1);

    const kept = await addBenchNote(repo, {
      ref: job.ref,
      text: "Charger is fine.",
      tag: null,
      nextMove: "   ",
      clientRequestId: "bench-note-0002",
      now: at(20),
    });
    expect(kept.ok).toBe(true);
    expect(repo.jobs[0]?.nextMove).toBe("Order a fan");

    const same = await addBenchNote(repo, {
      ref: job.ref,
      text: "Still the fan.",
      tag: "work_done",
      nextMove: "Order a fan",
      clientRequestId: "bench-note-0003",
      now: at(30),
    });
    expect(same.ok).toBe(true);
    expect(repo.jobs[0]?.updatedAt).toBe(at(10).toISOString());

    const blocked = await addBenchNote(repo, {
      ref: job.ref,
      text: "Do not file this.",
      tag: "finding",
      nextMove: "Two\nlines",
      clientRequestId: "bench-note-0004",
      now: at(40),
    });
    expect(blocked).toEqual({ ok: false, message: "Next move must be a single line." });
    expect(repo.notes).toHaveLength(3);
    expect(repo.jobs[0]?.nextMove).toBe("Order a fan");

    const empty = await addBenchNote(repo, {
      ref: job.ref,
      text: "   ",
      tag: null,
      nextMove: null,
      clientRequestId: "bench-note-0005",
      now: at(50),
    });
    expect(empty.ok).toBe(false);
    expect(repo.notes).toHaveLength(3);
  });
});

describe("bench status", () => {
  it("uses the shared status change, including the close clock", async () => {
    const repo = new MemoryJobRepository();
    const job = await benchJob(repo, { customerName: "Ada Lovelace", deviceLabel: "MacBook Pro 2019" });

    const diagnosing = await setBenchStatus(repo, job.ref, "diagnosing", at(5));
    expect(diagnosing.ok).toBe(true);
    if (!diagnosing.ok) return;
    expect(diagnosing.value.status).toBe("diagnosing");
    expect(diagnosing.value.closedAt).toBeNull();

    const collected = await setBenchStatus(repo, job.ref, "collected", at(15));
    expect(collected.ok).toBe(true);
    if (!collected.ok) return;
    expect(collected.value.closedAt).toBe(at(15).toISOString());

    const closed = await setBenchStatus(repo, job.ref, "closed_no_repair", at(25));
    expect(closed.ok).toBe(true);
    if (!closed.ok) return;
    expect(closed.value.closedAt).toBe(at(15).toISOString());

    const reopened = await setBenchStatus(repo, job.ref, "ready", at(35));
    expect(reopened.ok).toBe(true);
    if (!reopened.ok) return;
    expect(reopened.value.status).toBe("ready");
    expect(reopened.value.closedAt).toBeNull();

    const rejected = await setBenchStatus(repo, job.ref, "open", at(45));
    expect(rejected.ok).toBe(false);
    expect(repo.jobs[0]?.status).toBe("ready");
  });

  it("saves a one-line next move on its own", async () => {
    const repo = new MemoryJobRepository();
    const job = await benchJob(repo, { customerName: "Ada Lovelace", deviceLabel: "MacBook Pro 2019" });
    const saved = await saveBenchNextMove(repo, job.ref, "  Check the charger  ", at(5));
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.nextMove).toBe("Check the charger");
    const blank = await saveBenchNextMove(repo, job.ref, "  ", at(6));
    expect(blank.ok).toBe(false);
    expect(repo.jobs[0]?.nextMove).toBe("Check the charger");
  });
});

describe("bench create", () => {
  it("stores a phone number from the form and leaves it off the action shape", async () => {
    const repo = new MemoryJobRepository();
    const created = await createBenchJob(repo, {
      customerName: "Ada Lovelace",
      deviceLabel: "MacBook Pro 2019",
      reportedFault: "No power",
      phone: "07700 900 999",
      now: NOW,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.phone).toBe("07700 900 999");
    expect(created.value.nextMove).toBe("Diagnose the reported fault");
    expect(toPublicJob(created.value)).not.toHaveProperty("phone");
    expect(JSON.stringify(toPublicJob(created.value))).not.toContain("07700");
    expect(telHref(created.value.phone ?? "")).toBe("tel:07700900999");

    const loaded = await loadBenchJob(repo, created.value.ref.toLowerCase());
    expect(loaded?.job.phone).toBe("07700 900 999");

    const blank = await createBenchJob(repo, {
      customerName: "Grace Hopper",
      deviceLabel: "ThinkPad",
      reportedFault: "Slow",
      phone: "   ",
      now: at(1),
    });
    expect(blank.ok).toBe(true);
    if (!blank.ok) return;
    expect(blank.value.phone).toBeNull();

    const bad = await createBenchJob(repo, {
      customerName: "Grace Hopper",
      deviceLabel: "ThinkPad",
      reportedFault: "Slow",
      phone: "call me",
      now: at(2),
    });
    expect(bad.ok).toBe(false);
    expect(repo.jobs).toHaveLength(2);

    const missing = await createBenchJob(repo, {
      customerName: " ",
      deviceLabel: "ThinkPad",
      reportedFault: "Slow",
      phone: "",
      now: at(3),
    });
    expect(missing).toEqual({ ok: false, message: "Customer name is required." });
  });
});

describe("bench list", () => {
  it("shows active jobs first and can include finished ones", async () => {
    const repo = new MemoryJobRepository();
    const ada = await benchJob(repo, {
      customerName: "Ada Lovelace",
      deviceLabel: "MacBook Pro 2019",
      phone: PHONE,
      now: at(0),
    });
    const alan = await benchJob(repo, {
      customerName: "Alan Turing",
      deviceLabel: "Custom tower",
      now: at(10),
    });
    const grace = await benchJob(repo, {
      customerName: "Grace Hopper",
      deviceLabel: "Desktop",
      now: at(20),
    });
    await setBenchStatus(repo, grace.ref, "collected", at(30));

    const activeOnly = await listBenchJobs(repo, { search: "", includeFinished: false });
    expect(activeOnly.active.map((row) => row.ref)).toEqual([alan.ref, ada.ref]);
    expect(activeOnly.finished).toEqual([]);
    expect(JSON.stringify(activeOnly)).not.toContain(PHONE);
    expect(activeOnly.active[0]).not.toHaveProperty("phone");

    const withFinished = await listBenchJobs(repo, { search: "", includeFinished: true });
    expect(withFinished.active.map((row) => row.ref)).toEqual([alan.ref, ada.ref]);
    expect(withFinished.finished.map((row) => row.ref)).toEqual([grace.ref]);
    expect(withFinished.finished[0]?.status).toBe("collected");

    const byDevice = await listBenchJobs(repo, { search: "tower", includeFinished: true });
    expect(byDevice.active.map((row) => row.customerName)).toEqual(["Alan Turing"]);
    const byName = await listBenchJobs(repo, { search: "ada", includeFinished: false });
    expect(byName.active.map((row) => row.ref)).toEqual([ada.ref]);
    const hidden = await listBenchJobs(repo, { search: grace.ref, includeFinished: false });
    expect(hidden.active).toEqual([]);
    expect(hidden.finished).toEqual([]);
    const shown = await listBenchJobs(repo, { search: grace.ref, includeFinished: true });
    expect(shown.finished).toHaveLength(1);
  });
});

describe("phone links", () => {
  it("accepts a normal number and refuses a link that is not a number", () => {
    expect(parsePhone("")).toEqual({ ok: true, phone: null });
    const parsed = parsePhone("+44 7700 900999");
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.phone).toBe("+44 7700 900999");
    expect(telHref("+44 7700 900999")).toBe("tel:+447700900999");
    expect(parsePhone("nope").ok).toBe(false);
    expect(telHref("javascript:alert(1)")).toBeNull();
  });
});

describe("bench time", () => {
  it("formats London time", () => {
    const formatted = formatBenchTime("2026-09-29T09:00:00.000Z");
    expect(formatted).toContain("2026");
    expect(formatted).toContain("10:00");
  });
});

describe("photos", () => {
  it("builds a private path and rejects anything that is not an id", () => {
    const jobId = "11111111-1111-4111-8111-111111111111";
    const photoId = "22222222-2222-4222-8222-222222222222";
    expect(jobPhotoPath(jobId, photoId)).toBe(`${jobId}/${photoId}.jpg`);
    expect(() => jobPhotoPath("../secret", photoId)).toThrow(/photo path/i);
    expect(() => jobPhotoPath(jobId, `${photoId}/extra`)).toThrow(/photo path/i);
  });

  it("recognises a JPEG and fits the long edge to 1600", () => {
    expect(isJpeg(Uint8Array.from([0xff, 0xd8, 0xff, 0xdb]))).toBe(true);
    expect(isJpeg(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
    expect(PHOTO_MAX_EDGE).toBe(1600);
    expect(PHOTO_JPEG_QUALITY).toBe(0.8);
    expect(fittedSize(3200, 1600)).toEqual({ width: 1600, height: 800 });
    expect(fittedSize(1000, 4000)).toEqual({ width: 400, height: 1600 });
    expect(fittedSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("prepares photos as a new JPEG on a canvas, which drops location metadata", () => {
    const source = readFileSync("src/lib/photos/compress.ts", "utf8");
    expect(source).toContain("toBlob");
    expect(source).toContain("image/jpeg");
    expect(source).toContain("PHOTO_JPEG_QUALITY");
    expect(source).not.toMatch(/piexif|exif-js|exifr|sharp/i);
  });

  it("signs newest first for five minutes on the private bucket, without a storage path field", async () => {
    const older = "2026-09-29T09:00:00.000Z";
    const newer = "2026-09-29T10:00:00.000Z";
    const calls: string[] = [];
    const views = await signJobPhotos(
      [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          jobId: "11111111-1111-4111-8111-111111111111",
          noteId: null,
          storagePath: "11111111-1111-4111-8111-111111111111/older.jpg",
          takenAt: older,
          caption: "Older",
          createdAt: older,
        },
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          jobId: "11111111-1111-4111-8111-111111111111",
          noteId: null,
          storagePath: "11111111-1111-4111-8111-111111111111/newer.jpg",
          takenAt: newer,
          caption: null,
          createdAt: newer,
        },
      ],
      async (path) => {
        calls.push(path);
        return `https://signed.example/${calls.length}`;
      },
    );
    expect(calls[0]).toContain("newer.jpg");
    expect(views.map((view) => view.id)).toEqual([
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ]);
    expect(views[0]).not.toHaveProperty("storagePath");
    expect(JSON.stringify(views)).not.toContain("newer.jpg");

    const signedCalls: Array<{ bucket: string; path: string; seconds: number }> = [];
    const client = {
      storage: {
        from(bucket: string) {
          return {
            createSignedUrl(path: string, seconds: number) {
              signedCalls.push({ bucket, path, seconds });
              return Promise.resolve({ data: { signedUrl: "https://signed.example/photo" }, error: null });
            },
          };
        },
      },
    } as unknown as SupabaseClient<Database>;
    await expect(createPrivatePhotoUrl(client, "job/photo.jpg")).resolves.toBe("https://signed.example/photo");
    expect(signedCalls).toEqual([
      { bucket: JOB_PHOTOS_BUCKET, path: "job/photo.jpg", seconds: PHOTO_SIGNED_URL_SECONDS },
    ]);
    expect(PHOTO_SIGNED_URL_SECONDS).toBe(300);
    expect(JOB_PHOTOS_BUCKET).toBe("job-photos");

    const failing = {
      storage: {
        from() {
          return {
            createSignedUrl() {
              return Promise.resolve({ data: null, error: { message: "no" } });
            },
          };
        },
      },
    } as unknown as SupabaseClient<Database>;
    await expect(createPrivatePhotoUrl(failing, "job/photo.jpg")).rejects.toThrow(/signed photo URL/);
  });
});

describe("public paths", () => {
  it("leaves the manifest and the action API outside the sign-in wall", () => {
    expect(isPublicPath("/manifest.webmanifest")).toBe(true);
    expect(isPublicPath("/openapi.json")).toBe(true);
    expect(isPublicPath("/api/actions/jobs")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/jobs/LL-4K7M")).toBe(false);
  });
});

describe("action responses", () => {
  it("never contain a phone number or a photo path", async () => {
    const repo = new MemoryJobRepository();
    const created = await createBenchJob(repo, {
      customerName: "Ada Lovelace",
      deviceLabel: "MacBook Pro 2019",
      reportedFault: "No power",
      phone: PHONE,
      now: NOW,
    });
    if (!created.ok) throw new Error(created.message);
    const photoId = "22222222-2222-4222-8222-222222222222";
    const storagePath = jobPhotoPath(created.value.id, photoId);
    await repo.addPhoto({
      id: photoId,
      jobId: created.value.id,
      storagePath,
      caption: "Cracked hinge",
      takenAt: NOW.toISOString(),
    });

    const calendarCalls: Array<{ description: string }> = [];
    const calendar: CalendarPort = {
      status: () => ({ configured: true, missing: [] }),
      async upsertPrivateEvent(input) {
        calendarCalls.push({ description: input.description });
        return { eventId: input.eventId ?? "evt_1", action: input.eventId ? "updated" : "created" };
      },
      async deleteEvent() {
        return undefined;
      },
    };
    const runtime: ActionRuntime = {
      repo,
      now: () => NOW,
      calendar,
      apiKey: API_KEY,
      configurationError: null,
      rateLimit: { limit: 50, windowMs: 60_000 },
    };

    async function call(response: Response) {
      const text = await response.text();
      expect(response.ok).toBe(true);
      expect(text).not.toContain(PHONE);
      expect(text).not.toContain(storagePath);
      expect(text.toLowerCase()).not.toContain("storage_path");
      expect(text.toLowerCase()).not.toContain("signedurl");
      expect(text.toLowerCase()).not.toContain("signed_url");
      const body = JSON.parse(text) as unknown;
      const keys = collectKeys(body);
      expect(keys.has("phone")).toBe(false);
      expect(keys.has("storage_path")).toBe(false);
      expect(keys.has("storagePath")).toBe(false);
      return body as Record<string, unknown>;
    }

    function post(operation: Parameters<typeof handleAction>[1], body: unknown) {
      return handleAction(
        new Request("https://jobs.example/api/actions", {
          method: "POST",
          headers: {
            authorization: `Bearer ${API_KEY}`,
            "content-type": "application/json",
            "x-forwarded-for": "203.0.113.20",
          },
          body: JSON.stringify(body),
        }),
        operation,
        runtime,
      );
    }

    const detail = await call(
      await handleAction(
        new Request(`https://jobs.example/api/actions/jobs/${created.value.ref}`, {
          headers: { authorization: `Bearer ${API_KEY}`, "x-forwarded-for": "203.0.113.20" },
        }),
        "get_job",
        runtime,
        { ref: created.value.ref },
      ),
    );
    expect(detail.photo_count).toBe(1);
    expect(detail.photo_captions).toEqual(["Cracked hinge"]);

    const found = await call(
      await handleAction(
        new Request("https://jobs.example/api/actions/jobs?customer_name=Ada", {
          headers: { authorization: `Bearer ${API_KEY}`, "x-forwarded-for": "203.0.113.20" },
        }),
        "find_jobs",
        runtime,
      ),
    );
    expect(found.jobs).toHaveLength(1);

    const noted = await call(
      await post("add_note", {
        client_request_id: "bench-action-note-1",
        ref: created.value.ref,
        text: "Fan is noisy.",
        summary: "Fan is noisy",
        tag: "finding",
      }),
    );
    const noteId = (noted.note as { id: string }).id;

    await call(
      await post("edit_note", {
        client_request_id: "bench-action-edit-1",
        ref: created.value.ref,
        note_id: noteId,
        text: "Fan is noisy, not seized.",
      }),
    );
    await call(
      await post("set_status", {
        client_request_id: "bench-action-status-1",
        ref: created.value.ref,
        status: "diagnosing",
      }),
    );
    await call(
      await post("create_collection_event", {
        client_request_id: "bench-action-collect",
        ref: created.value.ref,
        collection_at: "2026-10-02T16:00:00+01:00",
      }),
    );
    expect(calendarCalls[0]?.description).not.toContain(PHONE);

    const other = await call(
      await post("create_job", {
        client_request_id: "bench-action-create-1",
        customer_name: "Alan Turing",
        device_label: "Custom tower",
        reported_fault: "No display",
        next_move: "Test the RAM",
      }),
    );
    expect(other).not.toHaveProperty("phone");
    const otherRef = String(other.ref);
    expect(repo.jobs.find((job) => job.ref === otherRef)?.phone).toBeNull();
    expect(repo.jobs.find((job) => job.ref === created.value.ref)?.phone).toBe(PHONE);

    const captions = await repo.listPhotoCaptions(created.value.id);
    expect(captions).toEqual({ count: 1, captions: ["Cracked hinge"] });
    expect(JSON.stringify(captions)).not.toContain(storagePath);
  });
});
