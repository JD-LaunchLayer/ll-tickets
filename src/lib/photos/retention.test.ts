import { describe, expect, it } from "vitest";
import { isPhotoExpired, photoRetentionCutoff } from "@/lib/photos/retention";

const now = new Date("2026-09-29T09:00:00.000Z");

describe("photo retention", () => {
  it("matches a 12-month close, and ignores open jobs", () => {
    expect(photoRetentionCutoff(now).toISOString()).toBe("2025-09-29T09:00:00.000Z");
    expect(
      isPhotoExpired({ status: "collected", closedAt: "2025-09-28T09:00:00.000Z", now }),
    ).toBe(true);
    expect(
      isPhotoExpired({ status: "closed_no_repair", closedAt: "2025-09-29T09:00:00.000Z", now }),
    ).toBe(false);
    expect(
      isPhotoExpired({ status: "collected", closedAt: "2026-09-28T09:00:00.000Z", now }),
    ).toBe(false);
    expect(
      isPhotoExpired({ status: "diagnosing", closedAt: "2020-01-01T00:00:00.000Z", now }),
    ).toBe(false);
    expect(isPhotoExpired({ status: "collected", closedAt: null, now })).toBe(false);
  });
});
