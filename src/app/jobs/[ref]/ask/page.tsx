import { notFound } from "next/navigation";
import { AskChat } from "@/app/ask/chat";
import { BenchShell } from "@/app/bench/shell";
import { isAssistantConfigured } from "@/lib/assistant/model";
import { ownerContext } from "@/lib/bench/context";
import { loadBenchJob } from "@/lib/bench/jobs";

export const dynamic = "force-dynamic";

export default async function JobAskPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const { repo } = await ownerContext();
  const loaded = await loadBenchJob(repo, ref);
  if (!loaded) notFound();
  const { job } = loaded;
  return (
    <BenchShell title="Ask the record" backHref={`/jobs/${job.ref}`} backLabel="Job" fill>
      <AskChat
        configured={isAssistantConfigured()}
        scopeRef={job.ref}
        detail={`${job.ref} · ${job.customerName} · ${job.deviceLabel}`}
      />
    </BenchShell>
  );
}
