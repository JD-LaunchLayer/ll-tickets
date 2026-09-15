import { describe, expect, it } from "vitest";
import { patchForBenchState, storedBenchState } from "./status";

describe("Bench state", () => {
  it("maps stored flags to open / waiting / done", () => {
    expect(storedBenchState({ status: "intake", waiting: false })).toBe("open");
    expect(storedBenchState({ status: "parts", waiting: true })).toBe("waiting");
    expect(storedBenchState({ status: "done", waiting: false })).toBe("done");
  });

  it("writes waiting without a stage machine", () => {
    expect(patchForBenchState("waiting", "intake")).toEqual({
      status: "intake",
      waiting: true,
    });
    expect(patchForBenchState("open", "done")).toEqual({
      status: "intake",
      waiting: false,
    });
    expect(patchForBenchState("done", "intake")).toEqual({
      status: "done",
      waiting: false,
    });
  });
});
