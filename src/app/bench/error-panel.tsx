import { RetryLink } from "@/app/bench/retry-link";

export function ErrorPanel({
  message,
  reason,
  retryHref,
}: {
  message: string;
  reason?: string | null;
  retryHref?: string;
}) {
  return (
    <div className="error-panel" role="alert">
      <p className="error-panel-message">{message}</p>
      {reason ? <p className="error-panel-reason">{reason}</p> : null}
      {retryHref ? <RetryLink href={retryHref} /> : null}
    </div>
  );
}
