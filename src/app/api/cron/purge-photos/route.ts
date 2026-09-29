import { bearerMatches } from "@/lib/auth/api-key";
import { purgeExpiredPhotos } from "@/lib/photos/purge";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

async function purge(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  if (!secret) {
    return Response.json(
      { error: { code: "not_configured", message: "CRON_SECRET is not set." } },
      { status: 503 },
    );
  }
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return Response.json(
      { error: { code: "unauthorised", message: "The cron secret was missing or not recognised." } },
      { status: 401 },
    );
  }
  try {
    const result = await purgeExpiredPhotos(createServiceClient());
    return Response.json(result);
  } catch {
    return Response.json(
      { error: { code: "internal_error", message: "Photo clean-up failed." } },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return purge(request);
}

export async function POST(request: Request) {
  return purge(request);
}
