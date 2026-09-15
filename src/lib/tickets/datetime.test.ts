import { describe, expect, it } from "vitest";
import {
  defaultAppointmentParts,
  dueAtForCreate,
  formatDateTimeLocal,
  isSilentMidnight,
  parseDateTimeLocal,
  replaceSilentMidnight,
  sanitizeAppointmentInput,
  zonedLocalToUtc,
} from "./datetime";

describe("sane appointment datetime", () => {
  it("treats 00:00 as silent midnight and bumps to 09:00", () => {
    const parsed = parseDateTimeLocal("2026-09-16T00:00");
    expect(parsed).not.toBeNull();
    expect(isSilentMidnight(parsed!.hour, parsed!.minute)).toBe(true);
    const sane = replaceSilentMidnight(parsed!);
    expect(sane.hour).toBe(9);
    expect(sane.minute).toBe(0);
    expect(sane.day).toBe(16);
  });

  it("keeps an explicit afternoon time", () => {
    const parsed = parseDateTimeLocal("2026-09-16T14:30");
    expect(replaceSilentMidnight(parsed!)).toEqual(parsed);
  });

  it("never returns midnight for a missing appointment value", () => {
    const now = zonedLocalToUtc({
      year: 2026,
      month: 9,
      day: 15,
      hour: 11,
      minute: 7,
      second: 0,
    });
    const due = sanitizeAppointmentInput("", now);
    const parts = defaultAppointmentParts(now);
    expect(parts.hour === 0 && parts.minute === 0).toBe(false);
    expect(due.getTime()).toBe(zonedLocalToUtc(parts).getTime());
  });

  it("defaults after close to next morning 09:00, not midnight", () => {
    const now = zonedLocalToUtc({
      year: 2026,
      month: 9,
      day: 15,
      hour: 18,
      minute: 10,
      second: 0,
    });
    const parts = defaultAppointmentParts(now);
    expect(formatDateTimeLocal(parts)).toBe("2026-09-16T09:00");
  });

  it("rounds a mid-slot time up to the next 15 minutes", () => {
    const now = zonedLocalToUtc({
      year: 2026,
      month: 9,
      day: 15,
      hour: 10,
      minute: 7,
      second: 20,
    });
    const parts = defaultAppointmentParts(now);
    expect(formatDateTimeLocal(parts)).toBe("2026-09-15T10:15");
  });

  it("walk-in uses now, even if a datetime field was posted", () => {
    const now = new Date("2026-09-15T13:42:00.000Z");
    const due = dueAtForCreate("walk_in", "2026-09-16T00:00", now);
    expect(due.toISOString()).toBe(now.toISOString());
  });
});
