import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/lib/auth/public-paths";

describe("public paths", () => {
  it("keeps install files and the action API public", () => {
    expect(isPublicPath("/manifest.webmanifest")).toBe(true);
    expect(isPublicPath("/api/cron/purge-photos")).toBe(true);
    expect(isPublicPath("/jobs/new")).toBe(false);
  });
});