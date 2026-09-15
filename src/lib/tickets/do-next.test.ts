import { describe, expect, it } from "vitest";
import {
  extraDoNextOutcomes,
  getDoNext,
  markableStatuses,
  markAsLabel,
  nextStatus,
  outcomeById,
} from "./do-next";

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

  it("has no check on done — jot composer still stands alone", () => {
    expect(getDoNext({ status: "done", waiting: false })).toBeNull();
    expect(nextStatus("done")).toBeNull();
    expect(extraDoNextOutcomes(null)).toEqual([]);
  });

  it("advances quietly along intake → diagnose → parts → done", () => {
    expect(nextStatus("intake")).toBe("diagnose");
    expect(nextStatus("diagnose")).toBe("parts");
    expect(nextStatus("parts")).toBe("done");
  });
});

describe("Notes-first accelerators", () => {
  it("offers Diagnose / Parts / Done as optional marks, never a gate", () => {
    expect(markableStatuses("intake")).toEqual(["diagnose", "parts", "done"]);
    expect(markableStatuses("diagnose")).toEqual(["parts", "done"]);
    expect(markableStatuses("parts")).toEqual(["diagnose", "done"]);
    expect(markableStatuses("done")).toEqual(["diagnose", "parts"]);
    expect(markAsLabel("diagnose")).toBe("Mark as Diagnose");
  });

  it("keeps waiting/resume chips as extras — not leading status marks", () => {
    const intake = extraDoNextOutcomes(getDoNext({ status: "intake", waiting: false }));
    expect(intake.map((o) => o.id)).toEqual(["wait-customer"]);

    const diagnose = extraDoNextOutcomes(
      getDoNext({ status: "diagnose", waiting: false }),
    );
    expect(diagnose.map((o) => o.id)).toEqual(["wait-customer"]);

    const parts = extraDoNextOutcomes(getDoNext({ status: "parts", waiting: false }));
    expect(parts.map((o) => o.id)).toEqual(["wait-parts"]);

    const waiting = extraDoNextOutcomes(
      getDoNext({ status: "parts", waiting: true }),
    );
    expect(waiting.map((o) => o.id)).toEqual(["resume"]);
  });
});
