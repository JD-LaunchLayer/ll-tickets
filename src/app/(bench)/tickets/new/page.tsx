import { CreateTicketForm } from "@/app/(bench)/tickets/new/create-ticket-form";
import { BenchHeader } from "@/components/bench-header";

export const dynamic = "force-dynamic";

export default function NewTicketPage() {
  return (
    <>
      <BenchHeader title="New ticket" backHref="/tickets" />
      <main className="flex-1 px-4 py-3">
        <CreateTicketForm />
      </main>
    </>
  );
}
