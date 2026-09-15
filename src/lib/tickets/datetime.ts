/** Shop clock is always Europe/London. Never persist a silent midnight. */
export const SHOP_TZ = "Europe/London";
export const SHOP_OPEN_HOUR = 9;
export const SHOP_OPEN_MINUTE = 0;
export const SHOP_CLOSE_HOUR = 17;
export const SHOP_CLOSE_MINUTE = 30;
export const SLOT_MINUTES = 15;

export type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function getZonedParts(date: Date, timeZone = SHOP_TZ): DateParts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
    second: pick("second"),
  };
}

function getTimeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = getZonedParts(instant, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - instant.getTime();
}

export function zonedLocalToUtc(
  parts: Omit<DateParts, "second"> & { second?: number },
  timeZone = SHOP_TZ,
): Date {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second ?? 0,
  );
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  let utc = utcGuess - offset;
  const offset2 = getTimeZoneOffsetMs(new Date(utc), timeZone);
  if (offset2 !== offset) utc = utcGuess - offset2;
  return new Date(utc);
}

export function addMinutesToParts(parts: DateParts, minutes: number): DateParts {
  const next = new Date(zonedLocalToUtc(parts).getTime() + minutes * 60_000);
  return getZonedParts(next);
}

export function addDays(parts: DateParts, days: number): DateParts {
  const noon = zonedLocalToUtc({ ...parts, hour: 12, minute: 0, second: 0 });
  return getZonedParts(new Date(noon.getTime() + days * 24 * 60 * 60 * 1000));
}

export function isSilentMidnight(hour: number, minute: number): boolean {
  return hour === 0 && minute === 0;
}

/** Date-only / empty time often lands on 00:00 — bump to shop open that day. */
export function replaceSilentMidnight(parts: DateParts): DateParts {
  if (!isSilentMidnight(parts.hour, parts.minute)) return parts;
  return {
    ...parts,
    hour: SHOP_OPEN_HOUR,
    minute: SHOP_OPEN_MINUTE,
    second: 0,
  };
}

export function isAfterClose(parts: DateParts): boolean {
  return (
    parts.hour > SHOP_CLOSE_HOUR ||
    (parts.hour === SHOP_CLOSE_HOUR && parts.minute > SHOP_CLOSE_MINUTE)
  );
}

export function isBeforeOpen(parts: DateParts): boolean {
  return (
    parts.hour < SHOP_OPEN_HOUR ||
    (parts.hour === SHOP_OPEN_HOUR && parts.minute < SHOP_OPEN_MINUTE)
  );
}

export function defaultAppointmentParts(now = new Date()): DateParts {
  let parts = { ...getZonedParts(now), second: 0 };
  const rem = parts.minute % SLOT_MINUTES;
  if (rem !== 0 || getZonedParts(now).second !== 0) {
    parts = addMinutesToParts(parts, rem === 0 ? SLOT_MINUTES : SLOT_MINUTES - rem);
    parts = { ...parts, second: 0 };
  }
  parts = replaceSilentMidnight(parts);
  if (isAfterClose(parts)) {
    const tomorrow = addDays(parts, 1);
    return {
      ...tomorrow,
      hour: SHOP_OPEN_HOUR,
      minute: SHOP_OPEN_MINUTE,
      second: 0,
    };
  }
  if (isBeforeOpen(parts)) {
    return {
      ...parts,
      hour: SHOP_OPEN_HOUR,
      minute: SHOP_OPEN_MINUTE,
      second: 0,
    };
  }
  return parts;
}

export function parseDateTimeLocal(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: 0,
  };
}

export function formatDateTimeLocal(parts: DateParts): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function sanitizeAppointmentInput(
  value: string,
  now = new Date(),
): Date {
  const parsed = parseDateTimeLocal(value);
  if (!parsed) return zonedLocalToUtc(defaultAppointmentParts(now));
  return zonedLocalToUtc(replaceSilentMidnight(parsed));
}

export function dueAtForCreate(
  kind: "walk_in" | "appointment",
  appointmentLocal: string | null,
  now = new Date(),
): Date {
  if (kind === "walk_in") return now;
  return sanitizeAppointmentInput(appointmentLocal ?? "", now);
}

export function shopDayKey(date: Date): string {
  const p = getZonedParts(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function isSameShopDay(a: Date, b: Date): boolean {
  return shopDayKey(a) === shopDayKey(b);
}

export function isFutureShopDay(due: Date, now: Date): boolean {
  return shopDayKey(due) > shopDayKey(now);
}

export function formatShopDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SHOP_TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatShopTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SHOP_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatShopDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SHOP_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
