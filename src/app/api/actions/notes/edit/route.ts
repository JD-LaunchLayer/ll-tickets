import { handleAction } from "@/lib/actions/handle";
import { productionRuntime } from "@/lib/actions/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleAction(request, "edit_note", productionRuntime());
}
