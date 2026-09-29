import { notFound } from "next/navigation";
import { AskChat, AskClear } from "@/app/ask/chat";
import { BenchShell } from "@/app/bench/shell";
import { isAssistantConfigured } from "@/lib/assistant/model";
import { ownerContext } from "@/lib/bench/context";
import { compactViewport } from "@/lib/bench/compact-viewport";
import { loadBenchJob } from "@/lib/bench/jobs";

export const dynamic = "force-dynamic";

export const viewport = compactViewport;

export default async function JobAskPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const { repo } = await ownerContext();
  const loaded = await loadBenchJob(repo, ref);
  if (!loaded) notFound();
  const { job } = loaded;
  return (
    <BenchShell
      title={`Ask · ${job.ref}`}
      chrome="bar"
      titlePlacement="bar"
      barTitleSize="md"
      backHref={`/jobs/${job.ref}`}
      barSubtitle={`${job.customerName} · ${job.deviceLabel}`}
      barAction={<AskClear scopeRef={job.ref} />}
      fill
    >
      <AskChat configured={isAssistantConfigured()} scopeRef={job.ref} />
    </BenchShell>
  );
}
