import { CreateJobForm } from "@/app/bench/forms";
import { BenchShell } from "@/app/bench/shell";
import { ownerContext } from "@/lib/bench/context";

export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  await ownerContext();

  return (
    <BenchShell title="New job" chrome="bar" titlePlacement="bar" barTitleSize="md" fill>
      <CreateJobForm />
    </BenchShell>
  );
}
