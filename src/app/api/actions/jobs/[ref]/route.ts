import { handleAction } from "@/lib/actions/handle";
import { productionRuntime } from "@/lib/actions/runtime";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ ref: string }> }) {
  const { ref } = await context.params;
  return handleAction(request, "get_job", productionRuntime(), { ref });
}
