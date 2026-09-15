import { describe, expect, it } from "vitest";
import { getDoNext, nextStatus, outcomeById } from "./do-next";

describe("Do next", () => {
  it("returns next, why, and outcome chips while the job is open", () => {
    const check = getDoNext({ status: "intake", waiting: false });
    expect(check?.next).toBe("Start diagnose");
    expect(check?.why).toMatch(/bench/i);
    expect(check?.outcomes.map((o) => o.id)).toContain("start-diagnose");
    expect(outcomeById(check, "start-diagnose")?.status).toBe("diagnose");
  });

  it("overrides with resume when waiting", () => {
    const check = getDoNext({ status: "parts", waiting: true });
    expect(check?.next).toBe("Resume this job");
    expect(check?.outcomes).toHaveLength(1);
    expect(check?.outcomes[0]?.waiting).toBe(false);
  });

  it("has no check on done so the UI falls back to add note", () => {
    expect(getDoNext({ status: "done", waiting: false })).toBeNull();
    expect(nextStatus("done")).toBeNull();
  });

  it("advances quietly along intake → diagnose → parts → done", () => {
    expect(nextStatus("intake")).toBe("diagnose");
    expect(nextStatus("diagnose")).toBe("parts");
    expect(nextStatus("parts")).toBe("done");
  });
});
