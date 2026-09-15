import { describe, expect, it } from "vitest";
import { zonedLocalToUtc } from "./datetime";
import { filterTickets, matchesListView } from "./filters";
import { listBenchState } from "./status";
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
    latest_finding: overrides.latest_finding ?? null,
    next_move: overrides.next_move ?? null,
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
  it("Open is not done and not waiting", () => {
    const open = ticket({
      status: "intake",
      waiting: false,
      due_at: tuesdayMorning.toISOString(),
    });
    const parked = ticket({
      id: "w",
      status: "parts",
      waiting: true,
      due_at: tuesdayMorning.toISOString(),
    });
    const done = ticket({
      id: "d",
      status: "done",
      waiting: false,
      due_at: tuesdayMorning.toISOString(),
    });
    expect(matchesListView(open, "open", tuesdayMorning)).toBe(true);
    expect(matchesListView(parked, "open", tuesdayMorning)).toBe(false);
    expect(matchesListView(parked, "waiting", tuesdayMorning)).toBe(true);
    expect(matchesListView(done, "done", tuesdayMorning)).toBe(true);
    expect(matchesListView(done, "open", tuesdayMorning)).toBe(false);
    expect(listBenchState(open, tuesdayMorning)).toBe("open");
    expect(listBenchState(parked, tuesdayMorning)).toBe("waiting");
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
    expect(matchesListView(booked, "open", tuesdayMorning)).toBe(false);
    expect(filterTickets([booked], "open", tuesdayMorning)).toHaveLength(0);
  });
});
