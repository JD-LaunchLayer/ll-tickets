import { AskChat, AskClear } from "@/app/ask/chat";
import { BenchShell } from "@/app/bench/shell";
import { isAssistantConfigured } from "@/lib/assistant/model";
import { requireOwnerSession } from "@/lib/auth/session";
import { compactViewport } from "@/lib/bench/compact-viewport";

export const dynamic = "force-dynamic";

export const viewport = compactViewport;

export default async function AskPage() {
  await requireOwnerSession();
  return (
    <BenchShell
      title="Ask the record"
      chrome="bar"
      titlePlacement="bar"
      barTitleSize="md"
      barAction={<AskClear scopeRef={null} />}
      fill
    >
      <AskChat configured={isAssistantConfigured()} scopeRef={null} />
    </BenchShell>
  );
}
