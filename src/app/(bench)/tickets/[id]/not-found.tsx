import Link from "next/link";

export default function TicketNotFound() {
  return (
    <main className="px-4 py-8">
      <p className="text-sm text-slate-700">That ticket is not on the bench.</p>
      <Link href="/tickets" className="mt-3 inline-block text-sm text-[#3b82f6] underline">
        Back to list
      </Link>
    </main>
  );
}
