/** Postgres / PostgREST fields safe to log and show. Row data and tokens are removed. */
export type RepositoryDbError = {
  code: string | null;
  message: string | null;
  details: string | null;
  hint: string | null;
};

function emptyDb(): RepositoryDbError {
  return { code: null, message: null, details: null, hint: null };
}

const TEXT_LIMIT = 180;

const JWT = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const KEY = /\b(?:sb_secret|sb_publishable|sbp)_[A-Za-z0-9_-]+/g;
const BEARER = /\bBearer\s+\S+/gi;
const QUERY_SECRET = /([?&](?:token|apikey|api_key|access_token|refresh_token)=)[^&\s]+/gi;
const FAILING_ROW = /Failing row contains \(.*$/i;

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/[\r\n\t]+/g, " ")
    .replace(FAILING_ROW, "[row omitted]")
    .replace(JWT, "[redacted]")
    .replace(KEY, "[redacted]")
    .replace(BEARER, "Bearer [redacted]")
    .replace(QUERY_SECRET, "$1[redacted]")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!text) return null;
  return text.length > TEXT_LIMIT ? text.slice(0, TEXT_LIMIT) : text;
}

function cleanCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim();
  return /^[A-Za-z0-9]{4,12}$/.test(code) ? code : null;
}

/** Copy only code, message, details and hint. Anything else on the error is dropped. */
export function readRepositoryDbError(error: unknown): RepositoryDbError {
  if (!error || typeof error !== "object") return emptyDb();
  const record = error as Record<string, unknown>;
  return {
    code: cleanCode(record.code),
    message: cleanText(record.message),
    details: cleanText(record.details),
    hint: cleanText(record.hint),
  };
}

export class RepositoryError extends Error {
  readonly db: RepositoryDbError;

  constructor(message: string, source?: unknown) {
    super(message);
    this.name = "RepositoryError";
    this.db = readRepositoryDbError(source);
  }
}

function shown(value: string | null): string {
  return JSON.stringify(value ?? "");
}

/** Log one line, then throw. `method` is the repository method that failed. */
export function reportRepositoryFailure(method: string, friendly: string, error: unknown): never {
  const db = error instanceof RepositoryError ? error.db : readRepositoryDbError(error);
  console.error(
    `SupabaseJobRepository.${method} failed ${friendly} code=${shown(db.code)} message=${shown(db.message)} details=${shown(db.details)} hint=${shown(db.hint)}`,
  );
  throw new RepositoryError(friendly, db);
}
