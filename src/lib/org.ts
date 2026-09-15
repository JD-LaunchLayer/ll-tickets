/** Single LaunchLayer shop — no multi-tenant UI. */
export const ORG = {
  id: "launchlayer",
  name: "LaunchLayer",
  shop: "Wickford repair",
} as const;

export type BenchSession = {
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  org: typeof ORG;
};

export function displayNameFromUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string {
  const meta = user.user_metadata ?? {};
  const fromMeta =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    "";
  if (fromMeta.trim()) return fromMeta.trim();
  const email = user.email ?? "";
  const local = email.split("@")[0];
  return local || "Tech";
}
