import { handleAction } from "@/lib/actions/handle";
import { productionRuntime } from "@/lib/actions/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleAction(request, "create_job", productionRuntime());
}

export async function GET(request: Request) {
  return handleAction(request, "find_jobs", productionRuntime());
}
