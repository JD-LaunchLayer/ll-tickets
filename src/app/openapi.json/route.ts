import spec from "../../../docs/gpt-actions.openapi.json";
import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      ...spec,
      servers: [
        {
          url: siteOrigin(),
          description: "This deployment.",
        },
      ],
    },
    { headers: { "cache-control": "no-store" } },
  );
}
