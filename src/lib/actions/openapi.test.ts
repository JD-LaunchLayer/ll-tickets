import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/openapi.json/route";

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
    expect(names.has("customer_name")).toBe(false);
    expect(JSON.stringify(spec)).toContain("Ready to collect");
    const status = spec.components.schemas.SetStatusRequest?.properties?.status as { enum?: string[] };
    expect(status.enum).toContain("ready");
    expect(names.has("password")).toBe(false);
    expect(names.has("storage_path")).toBe(false);
  });
});

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options", "trace"]);
const CHATGPT_TEXT_LIMIT = 300;
const OPERATION_ID_LIMIT = 64;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deref(root: JsonRecord, ref: string): JsonRecord | undefined {
  if (!ref.startsWith("#/")) return undefined;
  let node: unknown = root;
  for (const part of ref.slice(2).split("/")) {
    if (!isRecord(node)) return undefined;
    const key = decodeURIComponent(part.replaceAll("~1", "/").replaceAll("~0", "~"));
    node = node[key];
  }
  return isRecord(node) ? node : undefined;
}

function pushText(texts: { where: string; text: string }[], where: string, value: unknown) {
  if (typeof value === "string") texts.push({ where, text: value });
}

function collectPropertyDescriptions(
  node: unknown,
  path: string,
  texts: { where: string; text: string }[],
  seen: Set<unknown>,
) {
  if (!node || typeof node !== "object") return;
  if (seen.has(node)) return;
  seen.add(node);
  if (Array.isArray(node)) {
    node.forEach((item, index) => collectPropertyDescriptions(item, `${path}[${index}]`, texts, seen));
    return;
  }
  const record = node as JsonRecord;
  if (isRecord(record.properties)) {
    for (const [name, schema] of Object.entries(record.properties)) {
      if (isRecord(schema)) pushText(texts, `${path} property ${name}`, schema.description);
    }
  }
  for (const [key, value] of Object.entries(record)) {
    collectPropertyDescriptions(value, `${path}.${key}`, texts, seen);
  }
}

function collectParameterDescription(
  spec: JsonRecord,
  parameter: unknown,
  where: string,
  texts: { where: string; text: string }[],
) {
  const resolved =
    isRecord(parameter) && typeof parameter.$ref === "string" ? deref(spec, parameter.$ref) : parameter;
  if (!isRecord(resolved)) return;
  const name = typeof resolved.name === "string" ? resolved.name : where;
  pushText(texts, `${where} parameter ${name}`, resolved.description);
}

function actionLimits(spec: JsonRecord) {
  const operationIds: string[] = [];
  const texts: { where: string; text: string }[] = [];
  const paths = isRecord(spec.paths) ? spec.paths : {};

  for (const [path, item] of Object.entries(paths)) {
    if (!isRecord(item)) continue;
    if (Array.isArray(item.parameters)) {
      for (const parameter of item.parameters) {
        collectParameterDescription(spec, parameter, path, texts);
      }
    }
    for (const [method, operation] of Object.entries(item)) {
      if (!HTTP_METHODS.has(method) || !isRecord(operation)) continue;
      operationIds.push(typeof operation.operationId === "string" ? operation.operationId : "");
      const label = `${method.toUpperCase()} ${path}`;
      pushText(texts, `${label} description`, operation.description);
      pushText(texts, `${label} summary`, operation.summary);
      if (Array.isArray(operation.parameters)) {
        for (const parameter of operation.parameters) {
          collectParameterDescription(spec, parameter, label, texts);
        }
      }
    }
  }

  const components = isRecord(spec.components) ? spec.components : {};
  const shared = isRecord(components.parameters) ? components.parameters : {};
  for (const [name, parameter] of Object.entries(shared)) {
    collectParameterDescription(spec, parameter, `components.parameters.${name}`, texts);
  }
  collectPropertyDescriptions(spec, "$", texts, new Set());
  return { operationIds, texts };
}

describe("ChatGPT Action importer limits", () => {
  it("keeps operation text, parameter text, and operationIds within the importer limits", async () => {
    const response = GET();
    expect(response.headers.get("content-type")).toContain("application/json");
    const document = (await response.json()) as JsonRecord;
    const { operationIds, texts } = actionLimits(document);

    expect([...operationIds].sort()).toEqual([
      "add_note",
      "create_collection_event",
      "create_job",
      "edit_note",
      "find_jobs",
      "get_job",
      "set_status",
    ]);
    expect(new Set(operationIds).size).toBe(operationIds.length);
    for (const operationId of operationIds) {
      expect(operationId.length, operationId).toBeLessThanOrEqual(OPERATION_ID_LIMIT);
    }
    for (const { where, text } of texts) {
      expect(text.length, `${where} is ${text.length} characters`).toBeLessThanOrEqual(CHATGPT_TEXT_LIMIT);
    }
  });
});
