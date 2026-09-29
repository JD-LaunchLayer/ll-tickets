import { readFileSync } from "fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reportRepositoryFailure, RepositoryError } from "@/lib/jobs/repository-error";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("repository failure report", () => {
  it("logs one line for the method and keeps row data and tokens out of it", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const token = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signaturepart";
    let thrown: unknown;
    try {
      reportRepositoryFailure("createJob", "Could not create the job.", {
        code: "42501",
        message: `permission denied ${token}`,
        details: "Failing row contains (ada, 07700900123, secret-note)",
        hint: "see the policy",
        customer_name: "Should Not Appear",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(RepositoryError);
    const error = thrown as RepositoryError;
    expect(error.message).toBe("Could not create the job.");
    expect(error.db).toEqual({
      code: "42501",
      message: "permission denied [redacted]",
      details: "[row omitted]",
      hint: "see the policy",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toHaveLength(1);
    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).toContain("SupabaseJobRepository.createJob failed");
    expect(line).toContain("Could not create the job.");
    expect(line).toContain("42501");
    expect(line).toContain("permission denied [redacted]");
    expect(line).toContain("[row omitted]");
    expect(line).not.toContain(token);
    expect(line).not.toContain("07700900123");
    expect(line).not.toContain("Should Not Appear");
    expect(line).not.toContain("\n");
  });

  it("reports every Supabase failure from the repository, and only those", () => {
    const source = readFileSync("src/lib/jobs/supabase-repository.ts", "utf8");
    const plain = [...source.matchAll(/throw new RepositoryError\("([^"]+)"\)/g)].map((match) => match[1]);
    expect(plain.sort()).toEqual(["Could not allocate a job ref.", "The previous note text was not kept."].sort());

    const methods = [...source.matchAll(/reportRepositoryFailure\("([^"]+)"/g)].map((match) => match[1]);
    expect(methods).toEqual([
      "createJob",
      "updateJob",
      "getJobByRef",
      "findJobs",
      "findJobs",
      "addNote",
      "getNote",
      "editNote",
      "editNote",
      "listNotes",
      "listPhotos",
      "addPhoto",
      "listPhotoCaptions",
      "listRevisions",
      "claimIdempotency",
      "completeIdempotency",
      "writeAudit",
      "requireJob",
      "readIdempotency",
    ]);
  });
});
