import { describe, expect, it } from "vitest";
import { zonedLocalToUtc } from "./datetime";
import { filterTickets, matchesListView } from "./filters";
import type { TicketListItem } from "./types";

function ticket(
  overrides: Partial<TicketListItem> & Pick<TicketListItem, "status" | "waiting" | "due_at">,
): TicketListItem {
  return {
    id: overrides.id ?? "t1",
    customer_id: "c1",
    device_id: "d1",
    symptom: "Won't charge",
    created_by: null,
    created_at: "2026-09-15T08:00:00.000Z",
    updated_at: "2026-09-15T08:00:00.000Z",
    arrival_kind: "walk_in",
    customer: { id: "c1", name: "Smith", phone: null, email: null },
    device: { id: "d1", customer_id: "c1", label: "iPhone", serial: null },
    ...overrides,
  };
}

const tuesdayMorning = zonedLocalToUtc({
  year: 2026,
  month: 9,
  day: 15,
  hour: 10,
  minute: 0,
  second: 0,
});

describe("list filters", () => {
  it("Today is due today and not done", () => {
    const today = ticket({
      status: "intake",
      waiting: false,
      due_at: tuesdayMorning.toISOString(),
    });
    const tomorrow = ticket({
      id: "t2",
      status: "intake",
      waiting: false,
      due_at: zonedLocalToUtc({
        year: 2026,
        month: 9,
        day: 16,
        hour: 10,
        minute: 0,
        second: 0,
      }).toISOString(),
    });
    const doneToday = ticket({
      id: "t3",
      status: "done",
      waiting: false,
      due_at: tuesdayMorning.toISOString(),
    });
    expect(matchesListView(today, "today", tuesdayMorning)).toBe(true);
    expect(matchesListView(tomorrow, "today", tuesdayMorning)).toBe(false);
    expect(matchesListView(doneToday, "today", tuesdayMorning)).toBe(false);
    expect(matchesListView(doneToday, "done", tuesdayMorning)).toBe(true);
  });

  it("Active excludes waiting and done", () => {
    const active = ticket({
      status: "diagnose",
      waiting: false,
      due_at: tuesdayMorning.toISOString(),
    });
    const waiting = ticket({
      id: "w",
      status: "parts",
      waiting: true,
      due_at: tuesdayMorning.toISOString(),
    });
    expect(matchesListView(active, "active", tuesdayMorning)).toBe(true);
    expect(matchesListView(waiting, "active", tuesdayMorning)).toBe(false);
    expect(matchesListView(waiting, "waiting", tuesdayMorning)).toBe(true);
  });

  it("future appointments sit in Waiting", () => {
    const booked = ticket({
      status: "intake",
      waiting: false,
      arrival_kind: "appointment",
      due_at: zonedLocalToUtc({
        year: 2026,
        month: 9,
        day: 18,
        hour: 11,
        minute: 0,
        second: 0,
      }).toISOString(),
    });
    expect(matchesListView(booked, "waiting", tuesdayMorning)).toBe(true);
    expect(matchesListView(booked, "active", tuesdayMorning)).toBe(false);
    expect(filterTickets([booked], "today", tuesdayMorning)).toHaveLength(0);
  });
});
