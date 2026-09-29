import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

type Schema = {
  properties?: Record<string, Schema>;
  items?: Schema;
  additionalProperties?: boolean | Schema;
};

const spec = JSON.parse(readFileSync("docs/gpt-actions.openapi.json", "utf8")) as {
  openapi: string;
  paths: Record<string, Record<string, { operationId?: string; description?: string }>>;
  components: { securitySchemes: Record<string, { type: string; scheme?: string }>; schemas: Record<string, Schema> };
  security: Array<Record<string, unknown>>;
};

function propertyNames(schema: Schema | undefined, names: Set<string> = new Set()): Set<string> {
  if (!schema || typeof schema !== "object") return names;
  if (schema.properties) {
    for (const [key, nested] of Object.entries(schema.properties)) {
      names.add(key);
      propertyNames(nested, names);
    }
  }
  if (schema.items) propertyNames(schema.items, names);
  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    propertyNames(schema.additionalProperties, names);
  }
  return names;
}

describe("OpenAPI spec", () => {
  it("lists the seven actions and no messaging operation", () => {
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.security).toEqual([{ bearerAuth: [] }]);
    expect(spec.components.securitySchemes.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
    const operationIds = Object.values(spec.paths).flatMap((path) =>
      Object.values(path).map((operation) => operation.operationId),
    );
    expect(operationIds.sort()).toEqual(
      [
        "add_note",
        "create_collection_event",
        "create_job",
        "edit_note",
        "find_jobs",
        "get_job",
        "set_status",
      ].sort(),
    );
    const blob = JSON.stringify(spec.paths);
    expect(blob).not.toMatch(/sms|twilio|send_email|send_message/i);
    const names = propertyNames({ properties: spec.components.schemas });
    expect(names.has("phone")).toBe(false);
    expect(names.has("password")).toBe(false);
    expect(names.has("storage_path")).toBe(false);
  });
});
