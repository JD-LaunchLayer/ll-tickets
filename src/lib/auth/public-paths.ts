const PUBLIC_PREFIXES = ["/login", "/auth", "/api/actions", "/api/cron"] as const;

export function isPublicPath(path: string): boolean {
  if (path === "/openapi.json" || path === "/manifest.webmanifest") return true;
  return PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix));
}
