import { createSign } from "crypto";
import {
  COLLECTION_HOLD_MINUTES,
  collectionEventBody,
  type CalendarPort,
  type CalendarEventInput,
  type CalendarUpsertResult,
} from "@/lib/calendar/types";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

export function readServiceAccount(raw: string | undefined | null): ServiceAccount | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as { client_email?: unknown; private_key?: unknown };
    if (typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") return null;
    if (!parsed.client_email.includes("@") || !parsed.private_key.includes("PRIVATE KEY")) return null;
    return { client_email: parsed.client_email, private_key: parsed.private_key };
  } catch {
    return null;
  }
}

export function calendarMissingEnv(env: {
  calendarId?: string | null;
  serviceAccountJson?: string | null;
}): string[] {
  const missing: string[] = [];
  if (!env.calendarId?.trim()) missing.push("GOOGLE_CALENDAR_ID");
  if (!readServiceAccount(env.serviceAccountJson)) missing.push("GOOGLE_SERVICE_ACCOUNT_JSON");
  return missing;
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

export function signServiceAccountJwt(account: ServiceAccount, nowSeconds: number): string {
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: CALENDAR_SCOPE,
      aud: TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  return `${unsigned}.${signer.sign(account.private_key).toString("base64url")}`;
}

export function createGoogleCalendar(options: {
  calendarId: string | null;
  serviceAccountJson: string | null;
  fetchImpl?: FetchLike;
  now?: () => Date;
  durationMinutes?: number;
}): CalendarPort {
  const missing = calendarMissingEnv(options);
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  const duration = options.durationMinutes ?? COLLECTION_HOLD_MINUTES;
  let cached: { token: string; expiresAt: number } | null = null;

  async function accessToken(): Promise<string> {
    const account = readServiceAccount(options.serviceAccountJson);
    if (!account || !options.calendarId) throw new Error("Calendar is not configured.");
    const current = now().getTime();
    if (cached && cached.expiresAt > current + 60_000) return cached.token;
    const assertion = signServiceAccountJwt(account, Math.floor(current / 1000));
    const response = await fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
    });
    if (!response.ok) throw new Error("Google did not issue a calendar token.");
    const payload = (await response.json()) as { access_token?: string; expires_in?: number };
    if (!payload.access_token) throw new Error("Google did not issue a calendar token.");
    cached = {
      token: payload.access_token,
      expiresAt: current + (payload.expires_in ?? 3600) * 1000,
    };
    return payload.access_token;
  }

  function endpoint(eventId?: string): string {
    const calendarId = encodeURIComponent(options.calendarId ?? "");
    const base = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
    const url = eventId ? `${base}/${encodeURIComponent(eventId)}` : base;
    return `${url}?sendUpdates=none`;
  }

  async function createEvent(input: CalendarEventInput, token: string): Promise<CalendarUpsertResult> {
    const response = await fetchImpl(endpoint(), {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(collectionEventBody(input, duration)),
    });
    if (!response.ok) throw new Error("Google Calendar did not create the entry.");
    const payload = (await response.json()) as { id?: string };
    if (!payload.id) throw new Error("Google Calendar did not return an event id.");
    return { eventId: payload.id, action: "created" };
  }

  return {
    status: () => ({ configured: missing.length === 0, missing }),
    async deleteEvent(eventId: string) {
      const token = await accessToken();
      const response = await fetchImpl(endpoint(eventId), {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok && response.status !== 404) {
        throw new Error("Google Calendar did not delete the entry.");
      }
    },
    async upsertPrivateEvent(input: CalendarEventInput): Promise<CalendarUpsertResult> {
      const token = await accessToken();
      if (!input.eventId) return createEvent(input, token);
      const response = await fetchImpl(endpoint(input.eventId), {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(collectionEventBody(input, duration)),
      });
      if (response.status === 404) return createEvent(input, token);
      if (!response.ok) throw new Error("Google Calendar did not update the entry.");
      const payload = (await response.json()) as { id?: string };
      return { eventId: payload.id || input.eventId, action: "updated" };
    },
  };
}

export function createGoogleCalendarFromEnv(env: NodeJS.ProcessEnv = process.env): CalendarPort {
  return createGoogleCalendar({
    calendarId: env.GOOGLE_CALENDAR_ID ?? null,
    serviceAccountJson: env.GOOGLE_SERVICE_ACCOUNT_JSON ?? null,
  });
}
