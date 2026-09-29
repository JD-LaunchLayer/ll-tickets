import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isOwnerEmail } from "@/lib/auth/owner";
import { getSupabaseKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/supabase/env";

function isPublicPath(path: string): boolean {
  return (
    path.startsWith("/login") ||
    path.startsWith("/auth") ||
    path.startsWith("/api/actions") ||
    path.startsWith("/api/cron") ||
    path === "/openapi.json"
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  if (!isSupabaseConfigured()) {
    if (!isPublicPath(path)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as { email?: unknown } | undefined;
  const email = typeof claims?.email === "string" ? claims.email : null;
  const user = data?.claims ?? null;

  if (!user && !isPublicPath(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && path.startsWith("/login") && isOwnerEmail(email)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
