import type { JobStatus } from "@/lib/jobs/domain";
import { isClosedStatus } from "@/lib/jobs/domain";

/** Mirrors list_expired_job_photos: closed_at < now() - interval '12 months'. */
export function photoRetentionCutoff(now: Date): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 12);
  return cutoff;
}

export function isPhotoExpired(input: {
  status: JobStatus;
  closedAt: string | null;
  now: Date;
}): boolean {
  if (!input.closedAt || !isClosedStatus(input.status)) return false;
  return new Date(input.closedAt).getTime() < photoRetentionCutoff(input.now).getTime();
}
