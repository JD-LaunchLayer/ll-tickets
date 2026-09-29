import { readFileSync } from "fs";
import type { LanguageModelV4GenerateResult } from "@ai-sdk/provider";
import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/openapi.json/route";
import { NOT_CONFIGURED_MESSAGE } from "@/lib/assistant/copy";
import { WORKSHOP_RECORD_INSTRUCTIONS } from "@/lib/assistant/instructions";
import {
  HISTORY_MESSAGE_LIMIT,
  MAX_OUTPUT_TOKENS,
  MemoryAssistantUsage,
  TOOL_STEP_LIMIT,
  parseDailyLimit,
  usageDay,
} from "@/lib/assistant/limit";
import { parseAssistantRequest, type AssistantMessage } from "@/lib/assistant/messages";
import { DEFAULT_ASSISTANT_MODEL, assistantModelName, isAssistantConfigured } from "@/lib/assistant/model";
import { buildSystemPrompt } from "@/lib/assistant/prompt";
import { runAssistantTurn } from "@/lib/assistant/turn";
import { collectKeys } from "@/lib/jobs/domain";
import { MemoryJobRepository } from "@/lib/jobs/memory-repository";
import { RepositoryError } from "@/lib/jobs/repository-error";
import type { NewJob } from "@/lib/jobs/repository";

const NOW = "2026-09-29T09:00:00.000Z";
const PHONE = "07700 900123";
const PHONE_DIGITS = "07700900123";
const STORAGE_PATH = "jobs/private/hinge.jpg";

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

function textStep(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    finishReason: { unified: "stop" as const, raw: undefined },
    usage,
    warnings: [],
  };
}

function toolStep(toolName: string, input: unknown, id = "call-1") {
  return {
    content: [
      {
        type: "tool-call" as const,
        toolCallId: id,
        toolName,
        input: JSON.stringify(input),
      },
    ],
    finishReason: { unified: "tool-calls" as const, raw: undefined },
    usage,
    warnings: [],
  };
}

function scripted(steps: LanguageModelV4GenerateResult[]) {
  let index = 0;
  return async () => {
    const step = steps[Math.min(index, steps.length - 1)];
    index += 1;
    if (!step) throw new Error("No scripted step.");
    return step;
  };
}

async function seed(repo: MemoryJobRepository, phone: string | null = null) {
  const input: NewJob = {
    customerName: "Ada Lovelace",
    deviceLabel: "MacBook Pro 2019",
    reportedFault: "No power",
    nextMove: "Check the charger",
    priceGbp: null,
    priceBasis: null,
    priceAgreedAt: null,
    backupPosition: null,
    accessGiven: null,
    followUpAt: null,
    createdAt: NOW,
    phone,
  };
  return repo.createJob(input);
}

async function talk(options: {
  repo?: MemoryJobRepository;
  usageStore?: MemoryAssistantUsage;
  messages?: AssistantMessage[];
  scopeRef?: string | null;
  apiKey?: string;
  limit?: number;
  doGenerate: MockLanguageModelV4["doGenerate"];
}) {
  const repo = options.repo ?? new MemoryJobRepository();
  const usageStore = options.usageStore ?? new MemoryAssistantUsage();
  const model = new MockLanguageModelV4({ doGenerate: options.doGenerate });
  const result = await runAssistantTurn({
    messages: options.messages ?? [{ role: "user", text: "File it." }],
    scopeRef: options.scopeRef ?? null,
    apiKey: options.apiKey ?? "test-key",
    repo,
    usage: usageStore,
    dailyLimit: options.limit ?? 200,
    now: new Date(NOW),
    model,
  });
  return { result, model, repo, usageStore };
}

function promptBlob(model: MockLanguageModelV4): string {
  return JSON.stringify(model.doGenerateCalls.map((call) => call.prompt));
}

function toolResultValues(model: MockLanguageModelV4): unknown[] {
  const values: unknown[] = [];
  for (const call of model.doGenerateCalls) {
    for (const message of call.prompt) {
      if (typeof message.content === "string") continue;
      for (const part of message.content) {
        if (part.type !== "tool-result") continue;
        if (part.output.type === "json" || part.output.type === "text" || part.output.type === "error-text") {
          values.push(part.output.value);
        }
      }
    }
  }
  return values;
}

function assertNoPhone(model: MockLanguageModelV4) {
  const values = toolResultValues(model);
  expect(values.length).toBeGreaterThan(0);
  for (const value of values) {
    expect(collectKeys(value).has("phone")).toBe(false);
    expect(collectKeys(value).has("mobile")).toBe(false);
    expect(collectKeys(value).has("password")).toBe(false);
    const blob = JSON.stringify(value);
    expect(blob).not.toContain(PHONE);
    expect(blob).not.toContain(PHONE_DIGITS);
    expect(blob).not.toContain(STORAGE_PATH);
  }
}

describe("assistant limits", () => {
  it("defaults the daily limit and counts a UTC day", () => {
    expect(parseDailyLimit(undefined)).toBe(200);
    expect(parseDailyLimit("  ")).toBe(200);
    expect(parseDailyLimit("0")).toBe(200);
    expect(parseDailyLimit("nope")).toBe(200);
    expect(parseDailyLimit("15")).toBe(15);
    expect(usageDay(new Date("2026-09-29T23:30:00.000Z"))).toBe("2026-09-29");
    expect(HISTORY_MESSAGE_LIMIT).toBe(12);
    expect(MAX_OUTPUT_TOKENS).toBe(400);
    expect(TOOL_STEP_LIMIT).toBe(4);
  });

  it("stops counting once the day's limit is used", async () => {
    const store = new MemoryAssistantUsage();
    expect(await store.consume("2026-09-29", 1)).toBe(true);
    expect(await store.consume("2026-09-29", 1)).toBe(false);
    expect(store.counts.get("2026-09-29")).toBe(1);
    expect(await store.consume("2026-09-30", 1)).toBe(true);
  });
});

describe("assistant setup", () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.ASSISTANT_MODEL;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ASSISTANT_MODEL;
  });

  it("treats a missing key as not set up and keeps the default model name", () => {
    expect(isAssistantConfigured()).toBe(false);
    process.env.OPENAI_API_KEY = "   ";
    expect(isAssistantConfigured()).toBe(false);
    process.env.OPENAI_API_KEY = "sk-test";
    expect(isAssistantConfigured()).toBe(true);
    expect(assistantModelName()).toBe(DEFAULT_ASSISTANT_MODEL);
    process.env.ASSISTANT_MODEL = " gpt-5.4-mini ";
    expect(assistantModelName()).toBe("gpt-5.4-mini");
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.ASSISTANT_MODEL;
    else process.env.ASSISTANT_MODEL = previousModel;
  });
});

describe("assistant turn", () => {
  it("says the assistant is not set up and does not call the model or the counter", async () => {
    const { result, model, usageStore } = await talk({
      apiKey: "  ",
      doGenerate: async () => textStep("Should not run."),
    });
    expect(result).toEqual({ ok: false, code: "not_configured", message: NOT_CONFIGURED_MESSAGE });
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(usageStore.counts.size).toBe(0);
  });

  it("stops for the day without calling the model", async () => {
    const usageStore = new MemoryAssistantUsage();
    usageStore.counts.set("2026-09-29", 2);
    const { result, model } = await talk({
      usageStore,
      limit: 2,
      doGenerate: async () => textStep("Should not run."),
    });
    expect(result).toEqual({
      ok: false,
      code: "limit",
      message: "Today's limit is used up. Try again tomorrow.",
    });
    expect(model.doGenerateCalls).toHaveLength(0);
    expect(usageStore.counts.get("2026-09-29")).toBe(2);
  });

  it("does not count a message that never reaches the model", async () => {
    const { result, usageStore } = await talk({
      scopeRef: "not-a-ref",
      doGenerate: async () => textStep("No."),
    });
    expect(result).toEqual({ ok: false, code: "validation", message: "That job ref is not valid." });
    expect(usageStore.counts.size).toBe(0);
  });

  it("files a job through the shared record and keeps the phone off the model", async () => {
    const { result, model, repo } = await talk({
      doGenerate: scripted([
        toolStep("create_job", {
          customer_name: "Ada Lovelace",
          device_label: "MacBook Pro 2019",
          reported_fault: "No power",
          next_move: "Check the charger",
        }),
        textStep("LL-XXXX · Ada Lovelace · MacBook Pro 2019. Filed."),
      ]),
    });
    expect(result.ok).toBe(true);
    expect(repo.jobs).toHaveLength(1);
    expect(repo.jobs[0]?.phone).toBeNull();
    expect(repo.jobs[0]?.customerName).toBe("Ada Lovelace");
    expect(repo.jobs[0]?.nextMove).toBe("Check the charger");
    assertNoPhone(model);
    const names = (model.doGenerateCalls[0]?.tools ?? []).map((item) => item.type === "function" ? item.name : "");
    expect(names.sort()).toEqual(["add_note", "create_job", "edit_note", "find_jobs", "get_job", "set_status"]);
    expect(names).not.toContain("create_collection_event");
    for (const item of model.doGenerateCalls[0]?.tools ?? []) {
      if (item.type !== "function") continue;
      expect(collectKeys(item.inputSchema).has("phone")).toBe(false);
      expect(JSON.stringify(item.inputSchema)).not.toContain(PHONE);
    }
    expect(model.doGenerateCalls[0]?.maxOutputTokens).toBe(MAX_OUTPUT_TOKENS);
  });

  it("rejects an empty customer name with the record's validation, and files nothing", async () => {
    const { result, repo, model } = await talk({
      doGenerate: scripted([
        toolStep("create_job", {
          customer_name: "  ",
          device_label: "MacBook Pro 2019",
          reported_fault: "No power",
          next_move: "Check the charger",
        }),
        textStep("I need a name."),
      ]),
    });
    expect(result.ok).toBe(true);
    expect(repo.jobs).toHaveLength(0);
    const blob = JSON.stringify(toolResultValues(model));
    expect(blob).toContain("customer_name is required");
    expect(blob).not.toContain("that failed");
  });

  it("files a note and a status on the scoped job without being told the ref again", async () => {
    const repo = new MemoryJobRepository();
    const job = await seed(repo, PHONE);
    const noted = await talk({
      repo,
      scopeRef: job.ref,
      messages: [{ role: "user", text: "Add a note: fan is noisy. Next move order a fan." }],
      doGenerate: scripted([
        toolStep("add_note", {
          text: "Fan is noisy.",
          summary: "Fan is noisy",
          tag: "finding",
          next_move: "Order a fan",
        }),
        textStep(`${job.ref} · Ada Lovelace · MacBook Pro 2019. Noted.`),
      ]),
    });
    expect(noted.result.ok).toBe(true);
    expect(repo.notes).toHaveLength(1);
    expect(repo.notes[0]?.text).toBe("Fan is noisy.");
    expect(repo.notes[0]?.tag).toBe("finding");
    expect(repo.jobs[0]?.nextMove).toBe("Order a fan");
    assertNoPhone(noted.model);
    const system = noted.model.doGenerateCalls[0]?.prompt.find((message) => message.role === "system");
    expect(system && typeof system.content === "string" ? system.content : "").toContain(job.ref);
    expect(system && typeof system.content === "string" ? system.content : "").not.toContain(PHONE_DIGITS);

    const status = await talk({
      repo,
      scopeRef: job.ref,
      messages: [{ role: "user", text: "Waiting on parts, next move order battery." }],
      doGenerate: scripted([
        toolStep("set_status", { status: "waiting_on_parts", next_move: "Order battery" }),
        textStep(`${job.ref} · Ada Lovelace · MacBook Pro 2019. Waiting on parts.`),
      ]),
    });
    expect(status.result.ok).toBe(true);
    expect(repo.jobs[0]?.status).toBe("waiting_on_parts");
    expect(repo.jobs[0]?.nextMove).toBe("Order battery");
    expect(repo.jobs[0]?.phone).toBe(PHONE);
    assertNoPhone(status.model);
  });

  it("keeps the previous note wording when a note is edited", async () => {
    const repo = new MemoryJobRepository();
    const job = await seed(repo);
    const note = await repo.addNote({
      jobId: job.id,
      text: "Fan is noisy.",
      summary: "Fan is noisy",
      tag: "finding",
      amountGbp: null,
      partDetail: null,
      createdAt: NOW,
      clientRequestId: "asst-note-edit-0001",
    });
    const { result, repo: after } = await talk({
      repo,
      scopeRef: job.ref,
      doGenerate: scripted([
        toolStep("edit_note", { note_id: note.id, text: "Fan is very noisy." }),
        textStep(`${job.ref} · Ada Lovelace · MacBook Pro 2019. Note corrected.`),
      ]),
    });
    expect(result.ok).toBe(true);
    expect(after.notes[0]?.text).toBe("Fan is very noisy.");
    expect(after.revisions[0]?.text).toBe("Fan is noisy.");
  });

  it("sends get_job and find_jobs results with no phone field and no phone number", async () => {
    const repo = new MemoryJobRepository();
    const job = await seed(repo, PHONE);
    await repo.addNote({
      jobId: job.id,
      text: `Ring ${PHONE_DIGITS} about the hinge`,
      summary: `Rang ${PHONE}`,
      tag: "customer_contact",
      amountGbp: null,
      partDetail: null,
      createdAt: NOW,
      clientRequestId: "asst-note-phone-0001",
    });
    await repo.addPhoto({
      jobId: job.id,
      storagePath: STORAGE_PATH,
      takenAt: NOW,
      caption: "Hinge",
    });

    const loaded = await talk({
      repo,
      scopeRef: job.ref,
      messages: [{ role: "user", text: "Read this job." }],
      doGenerate: scripted([toolStep("get_job", {}), textStep(`${job.ref} · Ada Lovelace · MacBook Pro 2019.`)]),
    });
    expect(loaded.result.ok).toBe(true);
    assertNoPhone(loaded.model);
    const loadedBlob = JSON.stringify(toolResultValues(loaded.model));
    expect(loadedBlob).toContain("Hinge");
    expect(loadedBlob).toContain("Ring [omitted] about the hinge");
    expect(promptBlob(loaded.model)).not.toContain(PHONE_DIGITS);
    expect(promptBlob(loaded.model)).not.toContain(STORAGE_PATH);

    const found = await talk({
      repo,
      messages: [{ role: "user", text: "Find Ada." }],
      doGenerate: scripted([
        toolStep("find_jobs", { customer_name: "Ada" }),
        textStep(`${job.ref} · Ada Lovelace · MacBook Pro 2019.`),
      ]),
    });
    expect(found.result.ok).toBe(true);
    assertNoPhone(found.model);
    expect(JSON.stringify(toolResultValues(found.model))).toContain(job.ref);
  });

  it("tells the model only that a write failed, and names the cause for the phone", async () => {
    const repo = new MemoryJobRepository();
    const job = await seed(repo, PHONE);
    repo.addNote = async () => {
      throw new RepositoryError("Could not file the note.", {
        code: "42501",
        message: "new row violates row-level security policy for table notes",
        details: `Failing row contains (${PHONE_DIGITS}, secret-customer)`,
        hint: null,
      });
    };
    const { result, model } = await talk({
      repo,
      scopeRef: job.ref,
      doGenerate: scripted([
        toolStep("add_note", { text: "Fan is noisy.", summary: "Fan is noisy" }),
        textStep("That did not file."),
      ]),
    });
    expect(result).toMatchObject({
      ok: true,
      reply: "That did not file.",
      reasons: ["Reason: permission denied (42501)"],
    });
    const blob = promptBlob(model);
    expect(blob).toContain("that failed");
    expect(blob).not.toContain("row-level");
    expect(blob).not.toContain("secret-customer");
    expect(blob).not.toContain(PHONE_DIGITS);
    expect(blob).not.toContain("42501");
    assertNoPhone(model);
  });

  it("does not pass a provider error, or a key, back to the phone", async () => {
    const { result } = await talk({
      doGenerate: async () => {
        throw new Error("Incorrect API key sk-test-secret-value");
      },
    });
    expect(result).toEqual({ ok: false, code: "failed", message: "That failed.", reason: null });
    expect(JSON.stringify(result)).not.toContain("sk-test-secret-value");
    expect(JSON.stringify(result)).not.toContain("Incorrect API key");
  });

  it("sends only the last 12 messages and stops after four tool steps", async () => {
    const messages: AssistantMessage[] = [];
    for (let index = 0; index < 15; index += 1) {
      messages.push({
        role: index % 2 === 0 ? "user" : "assistant",
        text: index === 0 ? "oldest-line" : index === 14 ? "newest-line" : `line-${index}`,
      });
    }
    let calls = 0;
    const { model, result } = await talk({
      messages,
      doGenerate: async () => {
        calls += 1;
        return toolStep("find_jobs", {}, `call-${calls}`);
      },
    });
    expect(result).toMatchObject({ ok: true, reply: "Done." });
    expect(model.doGenerateCalls).toHaveLength(TOOL_STEP_LIMIT);
    const sent = model.doGenerateCalls[0]?.prompt.filter(
      (message) => message.role === "user" || message.role === "assistant",
    );
    expect(sent).toHaveLength(12);
    const blob = JSON.stringify(sent);
    expect(blob).not.toContain("oldest-line");
    expect(blob).toContain("newest-line");
  });
});

describe("assistant prompt and the Action API", () => {
  it("reuses the GPT instructions and states the in-app limits", () => {
    const markdown = readFileSync("docs/gpt-instructions.md", "utf8");
    const fenced = markdown.match(/```\n([\s\S]*?)\n```/);
    expect(fenced?.[1]).toBe(WORKSHOP_RECORD_INSTRUCTIONS);
    const prompt = buildSystemPrompt({
      ref: "LL-4K7M",
      customerName: "Ada Lovelace",
      deviceLabel: "MacBook Pro 2019",
      status: "diagnosing",
      nextMove: "Check the charger",
    });
    expect(prompt).toContain("You cannot see phone numbers and you cannot give phone numbers.");
    expect(prompt).toContain("ask at most one question");
    expect(prompt).toContain("Do not diagnose");
    expect(prompt).toContain("Do not give repair advice");
    expect(prompt).toContain("diagnostics are free");
    expect(prompt).toContain("£49");
    expect(prompt).toContain("£45");
    expect(prompt).toContain("You never send anything to a customer");
    expect(prompt).toContain("one plain line");
    expect(prompt).toContain("LL-4K7M");
    expect(prompt).not.toContain(PHONE);
    expect(prompt).toContain(WORKSHOP_RECORD_INSTRUCTIONS);
  });

  it("leaves the seven actions and /openapi.json unchanged", async () => {
    const spec = JSON.parse(readFileSync("docs/gpt-actions.openapi.json", "utf8")) as {
      paths: Record<string, Record<string, { operationId?: string }>>;
    };
    const fromFile = Object.values(spec.paths).flatMap((path) =>
      Object.values(path).map((operation) => operation.operationId),
    );
    const served = (await GET().json()) as { paths: Record<string, Record<string, { operationId?: string }>> };
    const fromRoute = Object.values(served.paths).flatMap((path) =>
      Object.values(path).map((operation) => operation.operationId),
    );
    const expected = [
      "add_note",
      "create_collection_event",
      "create_job",
      "edit_note",
      "find_jobs",
      "get_job",
      "set_status",
    ];
    expect(fromFile.sort()).toEqual(expected);
    expect(fromRoute.sort()).toEqual(expected);
    const routes: Array<[string, string]> = [
      ["src/app/api/actions/jobs/route.ts", "create_job"],
      ["src/app/api/actions/jobs/route.ts", "find_jobs"],
      ["src/app/api/actions/jobs/status/route.ts", "set_status"],
      ["src/app/api/actions/jobs/collection/route.ts", "create_collection_event"],
      ["src/app/api/actions/jobs/[ref]/route.ts", "get_job"],
      ["src/app/api/actions/notes/route.ts", "add_note"],
      ["src/app/api/actions/notes/edit/route.ts", "edit_note"],
    ];
    for (const [file, operation] of routes) {
      expect(readFileSync(file, "utf8")).toContain(`"${operation}"`);
    }
    expect(readFileSync("src/app/openapi.json/route.ts", "utf8")).toContain("gpt-actions.openapi.json");
  });

  it("trims a long thread to the last 12 lines", () => {
    const messages = Array.from({ length: 15 }, (_, index) => ({
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      text: index === 0 ? "oldest-line" : index === 14 ? "newest-line" : `line-${index}`,
    }));
    const parsed = parseAssistantRequest({ messages, scopeRef: null });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.messages).toHaveLength(12);
    expect(parsed.messages.some((message) => message.text === "oldest-line")).toBe(false);
    expect(parsed.messages[parsed.messages.length - 1]?.text).toBe("newest-line");
  });
});
