import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";
import { toPublicJob } from "@/lib/jobs/domain";
import { rowToJob } from "@/lib/jobs/supabase-repository";

type JobRow = Database["public"]["Tables"]["jobs"]["Row"];

describe("public job", () => {
  it("keeps the phone on the internal row and drops it from the action shape", () => {
    const row = {
      id: "6b1d4e0a-9c3d-4e0a-8c3d-1a2b3c4d5e6f",
      ref: "LL-4K7M",
      customer_name: "Ada Lovelace",
      phone: "07700900123",
      device_label: "MacBook Pro 2019",
      reported_fault: "No power",
      status: "new",
      next_move: "Check the charger",
      price_gbp: "49.50",
      price_basis: "estimate",
      price_agreed_at: null,
      backup_position: null,
      access_given: true,
      collection_at: null,
      calendar_event_id: null,
      follow_up_at: null,
      created_at: "2026-09-29T09:00:00.000Z",
      updated_at: "2026-09-29T09:00:00.000Z",
      closed_at: null,
    } as unknown as JobRow;
    const job = rowToJob(row);
    expect(job.phone).toBe("07700900123");
    expect(job.priceGbp).toBe(49.5);
    const published = toPublicJob(job);
    expect(published).not.toHaveProperty("phone");
    expect(JSON.stringify(published)).not.toContain("07700900123");
  });
});
