import { describe, expect, it } from "vitest";
import { ticketWhoDevice } from "./labels";

describe("ticketWhoDevice", () => {
  it("shows who · device, and hides the Device placeholder", () => {
    expect(
      ticketWhoDevice({
        customer: { name: "Smith" },
        device: { label: "iPhone" },
      }),
    ).toBe("Smith · iPhone");
    expect(
      ticketWhoDevice({
        customer: { name: "Smith" },
        device: { label: "Device" },
      }),
    ).toBe("Smith");
    expect(ticketWhoDevice({ customer: null, device: null })).toBe("Customer");
  });
});
