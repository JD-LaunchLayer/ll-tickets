import { describe, expect, it } from "vitest";
import { shouldPreventDocumentMove, type DocumentMoveInput } from "@/lib/bench/scroll-lock";

function move(overrides: Partial<DocumentMoveInput> = {}): DocumentMoveInput {
  return {
    pinch: false,
    relaxed: false,
    editable: false,
    inScrollable: true,
    scrollTop: 40,
    scrollHeight: 400,
    clientHeight: 200,
    deltaY: -12,
    ...overrides,
  };
}

describe("document rubber-band guard", () => {
  it("blocks a drag that starts on the bars, the action bar, or a sheet backdrop", () => {
    expect(shouldPreventDocumentMove(move({ inScrollable: false, deltaY: 20 }))).toBe(true);
    expect(shouldPreventDocumentMove(move({ inScrollable: false, deltaY: -20 }))).toBe(true);
  });

  it("lets a list, sheet, or chat scroll when the region has room in that direction", () => {
    expect(shouldPreventDocumentMove(move({ scrollTop: 40, deltaY: -12 }))).toBe(false);
    expect(shouldPreventDocumentMove(move({ scrollTop: 40, deltaY: 12 }))).toBe(false);
  });

  it("blocks the pull-down at the top and the push-up at the bottom", () => {
    expect(shouldPreventDocumentMove(move({ scrollTop: 0, deltaY: 16 }))).toBe(true);
    expect(shouldPreventDocumentMove(move({ scrollTop: 0, deltaY: -16 }))).toBe(false);
    expect(shouldPreventDocumentMove(move({ scrollTop: 200, deltaY: -16 }))).toBe(true);
    expect(shouldPreventDocumentMove(move({ scrollTop: 200, deltaY: 16 }))).toBe(false);
  });

  it("blocks any drag when the scroll region does not overflow", () => {
    expect(
      shouldPreventDocumentMove(move({ scrollTop: 0, scrollHeight: 180, clientHeight: 200, deltaY: 8 })),
    ).toBe(true);
    expect(
      shouldPreventDocumentMove(move({ scrollTop: 0, scrollHeight: 200, clientHeight: 200, deltaY: -8 })),
    ).toBe(true);
  });

  it("does not cancel pinch-zoom, text entry, the native select, or a relaxed keyboard", () => {
    expect(shouldPreventDocumentMove(move({ pinch: true, inScrollable: false }))).toBe(false);
    expect(shouldPreventDocumentMove(move({ editable: true, inScrollable: false, deltaY: 24 }))).toBe(false);
    expect(shouldPreventDocumentMove(move({ relaxed: true, inScrollable: false, deltaY: 24 }))).toBe(false);
    expect(shouldPreventDocumentMove(move({ relaxed: true, scrollTop: 0, deltaY: 24 }))).toBe(false);
  });
});
