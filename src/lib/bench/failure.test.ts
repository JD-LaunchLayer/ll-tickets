import { describe, expect, it } from "vitest";
import { jobListPanel } from "@/lib/bench/list-panel";
import { createBenchJob, saveBenchNextMove, setBenchStatus } from "@/lib/bench/jobs";
import { addBenchNote } from "@/lib/bench/notes";
import { reasonLine } from "@/lib/bench/reason";
import { MemoryJobRepository } from "@/lib/jobs/memory-repository";
import { RepositoryError } from "@/lib/jobs/repository-error";

const NOW = new Date("2026-09-29T09:00:00.000Z");

function denied(message = "Could not create the job."): RepositoryError {
  return new RepositoryError(message, {
    code: "42501",
    message: "new row violates row-level security policy for table jobs",
    details: 'Failing row contains (secret-customer, 07700900123)',
    hint: "Check the policy",
  });
}

describe("reason line", () => {
  it("maps the common Postgres and PostgREST codes", () => {
    const cases: Array<[string, string]> = [
      ["42501", "Reason: permission denied (42501)"],
      ["23505", "Reason: duplicate (23505)"],
      ["23514", "Reason: constraint check failed (23514)"],
      ["23502", "Reason: not-null (23502)"],
      ["PGRST301", "Reason: JWT problem (PGRST301)"],
      ["42P01", "Reason: missing table (42P01)"],
    ];
    for (const [code, line] of cases) {
      expect(reasonLine(new RepositoryError("Could not create the job.", { code, message: "raw", details: null, hint: null }))).toBe(
        line,
      );
    }
  });

  it("shows the raw code and message for an unknown code", () => {
    expect(
      reasonLine(
        new RepositoryError("Could not file the note.", {
          code: "23503",
          message: 'insert or update on table "notes" violates foreign key constraint',
          details: null,
          hint: null,
        }),
      ),
    ).toBe('Reason: 23503 insert or update on table "notes" violates foreign key constraint');
  });

  it("shows an unknown code on its own when there is no message", () => {
    expect(reasonLine({ code: "XX000" })).toBe("Reason: XX000");
  });

  it("uses the database message when there is no code", () => {
    expect(reasonLine({ message: "The object already exists" })).toBe("Reason: The object already exists");
  });

  it("does not repeat the friendly message or a failing row", () => {
    const error = denied();
    expect(error.message).toBe("Could not create the job.");
    expect(reasonLine(error)).toBe("Reason: permission denied (42501)");
    expect(error.db.details).toBe("[row omitted]");
    expect(error.db.message).not.toContain("07700900123");
    expect(JSON.stringify(error.db)).not.toContain("secret-customer");
  });

  it("drops tokens and leaves a validation failure without a reason", () => {
    const token = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signaturepart";
    const error = new RepositoryError("Could not search jobs.", {
      code: "PGRST302",
      message: `bad jwt ${token}`,
      details: "Bearer secret-token",
      hint: "sb_secret_abcdefghijklmnopqrstuvwxyz",
    });
    expect(reasonLine(error)).toBe("Reason: PGRST302 bad jwt [redacted]");
    expect(error.db.details).toBe("Bearer [redacted]");
    expect(error.db.hint).toBe("[redacted]");
    expect(JSON.stringify(error.db)).not.toContain(token);
    expect(JSON.stringify(error.db)).not.toContain("sb_secret_");
  });
});

describe("job list panel", () => {
  it("shows an error panel when listing throws, including when no rows came back", () => {
    const error = denied("Could not search jobs.");
    const panel = jobListPanel({
      failed: true,
      error,
      activeCount: 0,
      finishedCount: 0,
      search: "ada",
    });
    expect(panel).toEqual({
      kind: "error",
      message: "Could not load jobs.",
      reason: "Reason: permission denied (42501)",
    });
    expect(JSON.stringify(panel)).not.toContain("Nothing matches");
    expect(JSON.stringify(panel)).not.toContain("No jobs on the bench");
    expect(
      jobListPanel({ failed: true, error, activeCount: 3, finishedCount: 1, search: "" }).kind,
    ).toBe("error");
  });

  it("still shows the error panel when the thrown value has no detail", () => {
    expect(
      jobListPanel({ failed: true, error: null, activeCount: 0, finishedCount: 0, search: "" }),
    ).toEqual({
      kind: "error",
      message: "Could not load jobs.",
      reason: null,
    });
  });

  it("shows the empty state only after a successful query with nothing to show", () => {
    expect(
      jobListPanel({ failed: false, error: null, activeCount: 0, finishedCount: 0, search: "" }),
    ).toEqual({ kind: "empty", message: "No jobs on the bench." });
    expect(
      jobListPanel({ failed: false, error: null, activeCount: 0, finishedCount: 0, search: " ada " }),
    ).toEqual({ kind: "empty", message: "Nothing matches that search." });
    expect(
      jobListPanel({ failed: false, error: null, activeCount: 2, finishedCount: 0, search: "" }),
    ).toEqual({ kind: "jobs" });
    expect(
      jobListPanel({ failed: false, error: null, activeCount: 0, finishedCount: 1, search: "" }),
    ).toEqual({ kind: "jobs" });
  });
});

describe("phone save failures", () => {
  it("keeps the friendly message and adds the reason when the record rejects the write", async () => {
    const repo = new MemoryJobRepository();
    repo.createJob = async () => {
      throw denied();
    };
    const created = await createBenchJob(repo, {
      customerName: "Ada Lovelace",
      deviceLabel: "MacBook Pro 2019",
      reportedFault: "No power",
      phone: "",
      now: NOW,
    });
    expect(created).toEqual({
      ok: false,
      message: "Could not create the job.",
      reason: "Reason: permission denied (42501)",
    });

    const real = new MemoryJobRepository();
    const job = await createBenchJob(real, {
      customerName: "Ada Lovelace",
      deviceLabel: "MacBook Pro 2019",
      reportedFault: "No power",
      phone: "",
      now: NOW,
    });
    if (!job.ok) throw new Error(job.message);

    real.updateJob = async () => {
      throw denied("Could not update the job.");
    };
    const status = await setBenchStatus(real, job.value.ref, "diagnosing", NOW);
    expect(status).toEqual({
      ok: false,
      message: "Could not update the status.",
      reason: "Reason: permission denied (42501)",
    });
    const next = await saveBenchNextMove(real, job.value.ref, "Order a fan", NOW);
    expect(next).toEqual({
      ok: false,
      message: "Could not save the next move.",
      reason: "Reason: permission denied (42501)",
    });

    real.addNote = async () => {
      throw denied("Could not file the note.");
    };
    const note = await addBenchNote(real, {
      ref: job.value.ref,
      text: "Fan is noisy.",
      tag: "finding",
      nextMove: null,
      clientRequestId: "bench-note-fail-1",
      now: NOW,
    });
    expect(note).toEqual({
      ok: false,
      message: "Could not file the note.",
      reason: "Reason: permission denied (42501)",
    });
  });
});
