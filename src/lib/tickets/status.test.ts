import { describe, expect, it } from "vitest";
import { markableStatuses, markAsLabel, nextStatus } from "./status";

describe("Ticket status", () => {
  it("moves intake → diagnose → parts → done", () => {
    expect(nextStatus("intake")).toBe("diagnose");
    expect(nextStatus("diagnose")).toBe("parts");
    expect(nextStatus("parts")).toBe("done");
    expect(nextStatus("done")).toBeNull();
  });

  it("offers Diagnose / Parts / Done as optional marks, never a gate", () => {
    expect(markableStatuses("intake")).toEqual(["diagnose", "parts", "done"]);
    expect(markableStatuses("diagnose")).toEqual(["parts", "done"]);
    expect(markableStatuses("parts")).toEqual(["diagnose", "done"]);
    expect(markableStatuses("done")).toEqual(["diagnose", "parts"]);
    expect(markAsLabel("diagnose")).toBe("Mark as Diagnose");
  });
});
