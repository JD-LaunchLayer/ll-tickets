import { RepositoryError, readRepositoryDbError, type RepositoryDbError } from "@/lib/jobs/repository-error";

const KNOWN: Record<string, string> = {
  "42501": "permission denied",
  "23505": "duplicate",
  "23514": "constraint check failed",
  "23502": "not-null",
  PGRST301: "JWT problem",
  "42P01": "missing table",
};

function dbOf(error: unknown): RepositoryDbError {
  if (error instanceof RepositoryError) return error.db;
  return readRepositoryDbError(error);
}

/** Short line under a friendly phone message. Null when there is nothing useful to add. */
export function reasonLine(error: unknown): string | null {
  const db = dbOf(error);
  if (db.code) {
    const known = KNOWN[db.code];
    if (known) return `Reason: ${known} (${db.code})`;
    return db.message ? `Reason: ${db.code} ${db.message}` : `Reason: ${db.code}`;
  }
  return db.message ? `Reason: ${db.message}` : null;
}
