import { describe, expect, it } from "vitest";
import { canonicalJobRef, generateJobRef } from "@/lib/jobs/ref";

describe("job refs", () => {
  it("builds a short unambiguous ref", () => {
    expect(generateJobRef(() => 0)).toBe("LL-AAAA");
    expect(canonicalJobRef("ll-4k7m")).toBe("LL-4K7M");
    expect(canonicalJobRef("LL-IO01")).toBeNull();
    expect(canonicalJobRef("LL-4K7")).toBeNull();
  });
});
