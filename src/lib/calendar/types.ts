export type CalendarEventInput = {
  eventId: string | null;
  summary: string;
  description: string;
  startsAt: string;
};

export type CalendarUpsertResult = {
  eventId: string;
  action: "created" | "updated";
};

export type CalendarStatus = {
  configured: boolean;
  missing: string[];
};

/** Reused by the Action API and, later, the phone view. */
export type CalendarPort = {
  status: () => CalendarStatus;
  upsertPrivateEvent: (input: CalendarEventInput) => Promise<CalendarUpsertResult>;
  deleteEvent: (eventId: string) => Promise<void>;
};

export const COLLECTION_HOLD_MINUTES = 30;
export const COLLECTION_TIME_ZONE = "Europe/London";

export function collectionEventBody(input: CalendarEventInput, durationMinutes = COLLECTION_HOLD_MINUTES) {
  const start = new Date(input.startsAt);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return {
    summary: input.summary,
    description: input.description,
    start: { dateTime: start.toISOString(), timeZone: COLLECTION_TIME_ZONE },
    end: { dateTime: end.toISOString(), timeZone: COLLECTION_TIME_ZONE },
    visibility: "private",
    transparency: "opaque",
  };
}
