"use client";

export default function TicketError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="px-4 py-8">
      <p className="text-sm text-slate-700">Could not load this page.</p>
      <p className="mt-1 text-xs text-slate-500">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
      >
        Try again
      </button>
    </main>
  );
}
