import { createVerify, generateKeyPairSync } from "crypto";
import { describe, expect, it } from "vitest";
import { createGoogleCalendar } from "@/lib/calendar/google";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const serviceAccount = JSON.stringify({
  client_email: "jobs@example.iam.gserviceaccount.com",
  private_key: pem,
});

describe("Google Calendar", () => {
  it("reports missing configuration without calling the network", () => {
    const calendar = createGoogleCalendar({
      calendarId: "",
      serviceAccountJson: "{",
      fetchImpl: async () => {
        throw new Error("network should not be called");
      },
    });
    expect(calendar.status()).toEqual({
      configured: false,
      missing: ["GOOGLE_CALENDAR_ID", "GOOGLE_SERVICE_ACCOUNT_JSON"],
    });
  });

  it("creates a private event and updates it in place", async () => {
    const calls: Array<{ url: string; method: string; body: string }> = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? init.body : "";
      calls.push({ url, method, body });
      if (url.includes("oauth2.googleapis.com")) {
        return new Response(JSON.stringify({ access_token: "ya29.test-token", expires_in: 3600 }), {
          status: 200,
        });
      }
      if (method === "PATCH") {
        return new Response(JSON.stringify({ id: "evt_existing" }), { status: 200 });
      }
      if (method === "POST") {
        return new Response(JSON.stringify({ id: "evt_new" }), { status: 200 });
      }
      return new Response(null, { status: 204 });
    };
    const calendar = createGoogleCalendar({
      calendarId: "bench@group.calendar.google.com",
      serviceAccountJson: serviceAccount,
      fetchImpl,
      now: () => new Date("2026-09-29T09:00:00.000Z"),
    });

    const created = await calendar.upsertPrivateEvent({
      eventId: null,
      summary: "Collect LL-4K7M · Ada · MacBook",
      description: "Private workshop entry.",
      startsAt: "2026-10-02T15:00:00.000Z",
    });
    expect(created).toEqual({ eventId: "evt_new", action: "created" });

    const tokenCall = calls[0];
    const params = new URLSearchParams(tokenCall?.body ?? "");
    const jwt = params.get("assertion") ?? "";
    const [header, payload, signature] = jwt.split(".");
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${payload}`);
    expect(verifier.verify(publicKey, Buffer.from(signature ?? "", "base64url"))).toBe(true);
    const claims = JSON.parse(Buffer.from(payload ?? "", "base64url").toString()) as {
      iss: string;
      scope: string;
    };
    expect(claims.iss).toBe("jobs@example.iam.gserviceaccount.com");
    expect(claims.scope).toBe("https://www.googleapis.com/auth/calendar.events");

    const eventCall = calls[1];
    expect(eventCall?.method).toBe("POST");
    expect(eventCall?.url).toContain("sendUpdates=none");
    expect(eventCall?.url).toContain("bench%40group.calendar.google.com");
    const event = JSON.parse(eventCall?.body ?? "{}") as {
      visibility: string;
      attendees?: unknown;
      start: { timeZone: string; dateTime: string };
      end: { dateTime: string };
    };
    expect(event.visibility).toBe("private");
    expect(event.attendees).toBeUndefined();
    expect(event.start.timeZone).toBe("Europe/London");
    expect(new Date(event.end.dateTime).getTime() - new Date(event.start.dateTime).getTime()).toBe(
      30 * 60_000,
    );

    const updated = await calendar.upsertPrivateEvent({
      eventId: "evt_existing",
      summary: "Collect LL-4K7M · Ada · MacBook",
      description: "Private workshop entry.",
      startsAt: "2026-10-03T10:00:00.000Z",
    });
    expect(updated).toEqual({ eventId: "evt_existing", action: "updated" });
    expect(calls[2]?.method).toBe("PATCH");
    expect(calls[2]?.url).toContain("/evt_existing");
    expect(calls.filter((call) => call.url.includes("oauth2.googleapis.com"))).toHaveLength(1);
  });

  it("creates a replacement when the old event has gone", async () => {
    const methods: string[] = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      methods.push(method);
      if (url.includes("oauth2.googleapis.com")) {
        return new Response(JSON.stringify({ access_token: "ya29.test-token", expires_in: 3600 }), {
          status: 200,
        });
      }
      if (method === "PATCH") return new Response("missing", { status: 404 });
      return new Response(JSON.stringify({ id: "evt_replaced" }), { status: 200 });
    };
    const calendar = createGoogleCalendar({
      calendarId: "bench@group.calendar.google.com",
      serviceAccountJson: serviceAccount,
      fetchImpl,
    });
    const result = await calendar.upsertPrivateEvent({
      eventId: "evt_old",
      summary: "Collect",
      description: "Private",
      startsAt: "2026-10-02T15:00:00.000Z",
    });
    expect(result).toEqual({ eventId: "evt_replaced", action: "created" });
    expect(methods).toEqual(["POST", "PATCH", "POST"]);
  });
});
