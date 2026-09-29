import { AskChat } from "@/app/ask/chat";
import { BenchShell } from "@/app/bench/shell";
import { isAssistantConfigured } from "@/lib/assistant/model";
import { requireOwnerSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AskPage() {
  await requireOwnerSession();
  return (
    <BenchShell title="Ask the record" backHref="/" fill>
      <AskChat configured={isAssistantConfigured()} scopeRef={null} />
    </BenchShell>
  );
}
