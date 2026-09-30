import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import {
  SWIPE_ANGLE,
  SWIPE_DEAD_ZONE,
  SWIPE_LOCK_DISTANCE,
  SWIPE_MAX_DRAG,
  SWIPE_OPEN_DISTANCE,
  SWIPE_OPEN_VELOCITY,
  SWIPE_REVEAL,
  isArchiveStatus,
  swipeDecision,
  swipeInDeadZone,
  type SwipeGesture,
} from "@/lib/bench/swipe";

function gesture(partial: Partial<SwipeGesture> = {}): SwipeGesture {
  return {
    startX: 80,
    startY: 200,
    x: 80,
    y: 200,
    viewportWidth: 390,
    cardWidth: 358,
    velocity: 0,
    reducedMotion: false,
    axis: "undecided",
    ...partial,
  };
}

describe("swipeDecision", () => {
  it("ignores a gesture that starts in either 24px edge", () => {
    expect(swipeInDeadZone(SWIPE_DEAD_ZONE - 1, 390)).toBe(true);
    expect(swipeInDeadZone(SWIPE_DEAD_ZONE, 390)).toBe(false);
    expect(swipeInDeadZone(390 - SWIPE_DEAD_ZONE, 390)).toBe(false);
    expect(swipeInDeadZone(390 - SWIPE_DEAD_ZONE + 1, 390)).toBe(true);
    for (const startX of [10, 380]) {
      const decision = swipeDecision("end", gesture({ startX, x: startX - 80 }));
      expect(decision.ignore).toBe(true);
      expect(decision.openSheet).toBe(false);
      expect(decision.snap).toBe(0);
    }
  });

  it("stays undecided until 12px, then locks horizontal only inside 30 degrees", () => {
    const pending = swipeDecision("move", gesture({ x: 80 - (SWIPE_LOCK_DISTANCE - 1) }));
    expect(pending.axis).toBe("undecided");
    expect(pending.offset).toBe(0);
    expect(pending.snap).toBeNull();

    const flat = swipeDecision("move", gesture({ x: 80 - SWIPE_LOCK_DISTANCE, y: 200 }));
    expect(flat.axis).toBe("horizontal");

    const dx = 20;
    const limit = SWIPE_ANGLE * dx;
    const horizontal = swipeDecision("move", gesture({ x: 80 - dx, y: 200 + limit }));
    expect(horizontal.axis).toBe("horizontal");
    const vertical = swipeDecision(
      "move",
      gesture({ x: 80 - dx, y: 200 + limit + 1, axis: "undecided" }),
    );
    expect(vertical.axis).toBe("vertical");
    expect(vertical.offset).toBe(0);
    expect(swipeDecision("end", gesture({ x: 80 - dx, y: 200 + limit + 1 })).snap).toBe(0);
  });

  it("keeps a lock once it is chosen", () => {
    const later = swipeDecision(
      "move",
      gesture({ x: 40, y: 400, axis: "horizontal" }),
    );
    expect(later.axis).toBe("horizontal");
    expect(later.offset).not.toBe(0);
  });

  it("snaps open at 40px or a flick faster than 0.5px/ms, and shuts otherwise", () => {
    expect(swipeDecision("end", gesture({ x: 80 - SWIPE_OPEN_DISTANCE, axis: "horizontal" })).snap).toBe(-SWIPE_REVEAL);
    expect(swipeDecision("end", gesture({ x: 80 - (SWIPE_OPEN_DISTANCE - 1), axis: "horizontal" })).snap).toBe(0);
    expect(
      swipeDecision("end", gesture({ x: 70, velocity: SWIPE_OPEN_VELOCITY + 0.01, axis: "horizontal" })).snap,
    ).toBe(-SWIPE_REVEAL);
    expect(
      swipeDecision("end", gesture({ x: 70, velocity: SWIPE_OPEN_VELOCITY, axis: "horizontal" })).snap,
    ).toBe(0);
  });

  it("rubber-bands past 96px and stops at 144px, with no rubber-band when motion is reduced", () => {
    const atReveal = swipeDecision("move", gesture({ x: 80 - SWIPE_REVEAL, axis: "horizontal" }));
    expect(atReveal.offset).toBe(-SWIPE_REVEAL);
    const past = swipeDecision("move", gesture({ x: 80 - 216, axis: "horizontal" }));
    expect(past.offset).toBeCloseTo(-SWIPE_MAX_DRAG, 5);
    const further = swipeDecision("move", gesture({ x: 80 - 400, axis: "horizontal" }));
    expect(further.offset).toBe(-SWIPE_MAX_DRAG);
    const reduced = swipeDecision(
      "move",
      gesture({ x: 80 - 400, axis: "horizontal", reducedMotion: true }),
    );
    expect(reduced.offset).toBe(-SWIPE_REVEAL);
  });

  it("opens the archive sheet past half the card and never commits", () => {
    const half = gesture({ x: 80 - 179, axis: "horizontal", cardWidth: 358 });
    expect(swipeDecision("end", half).openSheet).toBe(false);
    expect(swipeDecision("end", half).snap).toBe(-SWIPE_REVEAL);
    const beyond = swipeDecision("end", gesture({ x: 80 - 180, axis: "horizontal", cardWidth: 358 }));
    expect(beyond.openSheet).toBe(true);
    expect(beyond.snap).toBe(0);
  });

  it("never reveals on pointercancel, and ignores a rightward drag", () => {
    const cancelled = swipeDecision("cancel", gesture({ x: 10, axis: "horizontal" }));
    expect(cancelled.snap).toBe(0);
    expect(cancelled.openSheet).toBe(false);
    expect(cancelled.offset).toBe(0);
    const right = swipeDecision("move", gesture({ x: 140, axis: "horizontal" }));
    expect(right.offset).toBe(0);
  });

  it("only archives to collected or closed", () => {
    expect(isArchiveStatus("collected")).toBe(true);
    expect(isArchiveStatus("closed_no_repair")).toBe(true);
    expect(isArchiveStatus("diagnosing")).toBe(false);
    expect(isArchiveStatus("ready")).toBe(false);
  });
});

function rule(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

function insideRounded(x: number, y: number, width: number, height: number, radius: number): boolean {
  if (x < 0 || y < 0 || x > width || y > height) return false;
  const rx = x < radius ? radius : x > width - radius ? width - radius : x;
  const ry = y < radius ? radius : y > height - radius ? height - radius : y;
  if (rx === x && ry === y) return true;
  const dx = x - rx;
  const dy = y - ry;
  return dx * dx + dy * dy <= radius * radius + 0.01;
}

describe("job menu button", () => {
  it("keeps a 48px control 8px inside the card at 360 and 390, in both themes", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const button = rule(css, ".icon-btn");
    expect(button).toContain("width: 48px");
    expect(button).toContain("height: 48px");
    expect(button).toContain("background: var(--surface)");
    expect(button).toContain("border: 1px solid var(--edge)");
    const more = rule(css, ".job-more");
    expect(more).toContain("right: 8px");
    expect(more).toContain("bottom: 8px");
    expect(more).not.toMatch(/right:\s*0/);
    expect(more).not.toMatch(/bottom:\s*0/);
    expect(more).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    const item = rule(css, ".swipe-item");
    expect(item).toContain("overflow: hidden");
    expect(item).toContain("border-radius: 16px");
    const face = rule(css, ".swipe-face");
    expect(face).toContain("overflow: visible");
    expect(rule(css, ".job-card")).not.toContain("overflow: hidden");
    const darkAt = css.indexOf("@media (prefers-color-scheme: dark)");
    const dark = css.slice(darkAt, darkAt + 700);
    expect(dark).toContain("--surface:");
    expect(dark).toContain("--edge:");
    const inset = 8;
    const size = 48;
    const radius = 16;
    for (const width of [360, 390, 360 - 32, 390 - 32]) {
      const height = 102;
      const left = width - inset - size;
      const top = height - inset - size;
      const corners: Array<[number, number]> = [
        [left, top],
        [left + size, top],
        [left, top + size],
        [left + size, top + size],
      ];
      for (const [x, y] of corners) {
        expect(insideRounded(x, y, width, height, radius), `${width} ${x},${y}`).toBe(true);
      }
      expect(width - (left + size)).toBeGreaterThanOrEqual(8);
      expect(height - (top + size)).toBeGreaterThanOrEqual(8);
    }
  });
});
