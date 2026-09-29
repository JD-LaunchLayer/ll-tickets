import { describe, expect, it } from "vitest";
import { bearerMatches } from "@/lib/auth/api-key";

describe("API key comparison", () => {
  it("accepts only a bearer token and ignores the scheme case", () => {
    expect(bearerMatches("Bearer workshop-key", "workshop-key")).toBe(true);
    expect(bearerMatches("bearer workshop-key", "workshop-key")).toBe(true);
    expect(bearerMatches("Bearer wrong-key", "workshop-key")).toBe(false);
    expect(bearerMatches("workshop-key", "workshop-key")).toBe(false);
    expect(bearerMatches(null, "workshop-key")).toBe(false);
    expect(bearerMatches("Bearer workshop-key", "")).toBe(false);
  });
});
