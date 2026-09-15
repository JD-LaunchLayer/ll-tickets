import { describe, expect, it } from "vitest";
import { markableStatuses, markAsLabel } from "./status";

describe("Ticket status", () => {
  it("offers Diagnose / Parts / Done as optional marks, never a gate", () => {
    expect(markableStatuses("intake")).toEqual(["diagnose", "parts", "done"]);
    expect(markableStatuses("diagnose")).toEqual(["parts", "done"]);
    expect(markableStatuses("parts")).toEqual(["diagnose", "done"]);
    expect(markableStatuses("done")).toEqual(["diagnose", "parts"]);
    expect(markAsLabel("diagnose")).toBe("Mark as Diagnose");
  });
});
