import { readFileSync } from "fs";
import type { LanguageModelV4GenerateResult } from "@ai-sdk/provider";
import { MockLanguageModelV4 } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/openapi.json/route";
import { JOB_SUGGESTIONS, LIST_SUGGESTIONS, NOT_CONFIGURED_MESSAGE, suggestionDraft, suggestionsFor } from "@/lib/assistant/copy";
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
import { defaultSaveTag, saveAssistantFinding } from "@/lib/assistant/save-note";
import { runAssistantTurn } from "@/lib/assistant/turn";
import * as record from "@/lib/jobs/record";
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
    expect(MAX_OUTPUT_TOKENS).toBe(900);
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

  it("registers only the read tools and does not file a job", async () => {
    const { result, model, repo } = await talk({
      doGenerate: async () => textStep("Check the DC jack before the board."),
    });
    expect(result.ok).toBe(true);
    expect(repo.jobs).toHaveLength(0);
    expect(repo.notes).toHaveLength(0);
    const names = (model.doGenerateCalls[0]?.tools ?? []).map((item) => (item.type === "function" ? item.name : ""));
    expect(names.sort()).toEqual(["find_jobs", "get_job"]);
    for (const blocked of ["create_job", "add_note", "edit_note", "set_status", "create_collection_event"]) {
      expect(names).not.toContain(blocked);
    }
    for (const item of model.doGenerateCalls[0]?.tools ?? []) {
      if (item.type !== "function") continue;
      expect(collectKeys(item.inputSchema).has("phone")).toBe(false);
      expect(JSON.stringify(item.inputSchema)).not.toContain(PHONE);
    }
    expect(model.doGenerateCalls[0]?.maxOutputTokens).toBe(MAX_OUTPUT_TOKENS);
  });

  it("re-injects the current job, including notes, and keeps the phone off the model", async () => {
    const repo = new MemoryJobRepository();
    const job = await seed(repo, PHONE);
    await repo.addNote({
      jobId: job.id,
      text: `Fan is noisy. Ring ${PHONE} if it comes back.`,
      summary: "Fan is noisy",
      tag: "finding",
      amountGbp: null,
      partDetail: null,
      createdAt: NOW,
      clientRequestId: "asst-context-note-0001",
    });
    const messages: AssistantMessage[] = [];
    for (let index = 0; index < 15; index += 1) {
      messages.push({
        role: index % 2 === 0 ? "user" : "assistant",
        text: index === 0 ? "oldest-line" : index === 14 ? "What should I test next?" : `line-${index}`,
      });
    }
    const { result, model } = await talk({
      repo,
      scopeRef: job.ref,
      messages,
      doGenerate: async () => textStep("Likely the charger. Measure the DC jack first."),
    });
    expect(result.ok).toBe(true);
    expect(repo.notes).toHaveLength(1);
    expect(repo.jobs[0]?.phone).toBe(PHONE_DIGITS);
    expect(repo.jobs[0]?.status).toBe("new");
    const system = model.doGenerateCalls[0]?.prompt.find((message) => message.role === "system");
    const content = system && typeof system.content === "string" ? system.content : "";
    expect(content).toContain(job.ref);
    expect(content).toContain("MacBook Pro 2019");
    expect(content).toContain("No power");
    expect(content).toContain("Status: new (New)");
    expect(content).toContain("Parts: none on the notes.");
    expect(content).toContain("Check the charger");
    expect(content).toContain("finding (Finding)");
    expect(content).toContain("Fan is noisy. Ring [omitted] if it comes back.");
    expect(content).toContain("re-sent every turn");
    expect(content).not.toContain(PHONE);
    expect(content).not.toContain(PHONE_DIGITS);
    const sent = model.doGenerateCalls[0]?.prompt.filter(
      (message) => message.role === "user" || message.role === "assistant",
    );
    expect(sent).toHaveLength(12);
    expect(JSON.stringify(sent)).not.toContain("oldest-line");
    expect(JSON.stringify(sent)).not.toContain("Fan is noisy");
    expect(promptBlob(model)).not.toContain(PHONE_DIGITS);
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
    expect(loadedBlob).not.toContain("Ada Lovelace");
    expect(loadedBlob).not.toContain("customer_name");
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
    const foundBlob = JSON.stringify(toolResultValues(found.model));
    expect(foundBlob).toContain(job.ref);
    expect(foundBlob).not.toContain("Ada Lovelace");
    expect(foundBlob).not.toContain("customer_name");
  });

  it("find_jobs matches the same fault on another model and does not ask the Action API to", async () => {
    const repo = new MemoryJobRepository();
    const omen = await repo.createJob({
      customerName: "Jordan Duggins",
      deviceLabel: "HP Omen 25l",
      reportedFault: "No power",
      nextMove: "Check the charger",
      priceGbp: null,
      priceBasis: null,
      priceAgreedAt: null,
      backupPosition: null,
      accessGiven: null,
      followUpAt: null,
      createdAt: NOW,
      phone: null,
    });
    const dell = await repo.createJob({
      customerName: "Test Customer",
      deviceLabel: "Dell Latitude",
      reportedFault: "No power",
      nextMove: "Check the charger",
      priceGbp: null,
      priceBasis: null,
      priceAgreedAt: null,
      backupPosition: null,
      accessGiven: null,
      followUpAt: null,
      createdAt: NOW,
      phone: null,
    });
    const { model } = await talk({
      repo,
      doGenerate: scripted([
        toolStep("find_jobs", { device: "power", status: "active" }),
        textStep("Nothing else like it."),
      ]),
    });
    const blob = JSON.stringify(toolResultValues(model));
    expect(blob).toContain(omen.ref);
    expect(blob).toContain(dell.ref);
    expect(blob).not.toContain("Jordan Duggins");
    expect(blob).not.toContain("Test Customer");
    expect(readFileSync("src/lib/actions/handle.ts", "utf8")).not.toContain("findJobsForAsk");
  });

  it("tells the model only that a read failed, and names the cause for the phone", async () => {
    const repo = new MemoryJobRepository();
    const job = await seed(repo, PHONE);
    const original = repo.getJobByRef.bind(repo);
    let calls = 0;
    repo.getJobByRef = async (ref) => {
      calls += 1;
      if (calls > 1) {
        throw new RepositoryError("Could not read the job.", {
          code: "42501",
          message: "new row violates row-level security policy for table jobs",
          details: `Failing row contains (${PHONE_DIGITS}, secret-customer)`,
          hint: null,
        });
      }
      return original(ref);
    };
    const { result, model } = await talk({
      repo,
      scopeRef: job.ref,
      doGenerate: scripted([toolStep("get_job", {}), textStep("I could not read it.")]),
    });
    expect(result).toMatchObject({
      ok: true,
      reply: "I could not read it.",
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
  it("uses the diagnostic rules and keeps the GPT fence in sync", () => {
    const markdown = readFileSync("docs/gpt-instructions.md", "utf8");
    const fenced = markdown.match(/```\n([\s\S]*?)\n```/);
    expect(fenced?.[1]).toBe(WORKSHOP_RECORD_INSTRUCTIONS);
    expect(WORKSHOP_RECORD_INSTRUCTIONS).toContain(
      "When he asks if he has seen this before, call find_jobs, answer from the record, and say plainly when nothing is on file.",
    );
    const prompt = buildSystemPrompt({
      ref: "LL-4K7M",
      customerName: "Ada Lovelace",
      deviceLabel: "MacBook Pro 2019",
      reportedFault: "No power",
      status: "diagnosing",
      nextMove: "Check the charger",
      priceGbp: null,
      priceBasis: null,
      priceAgreedAt: null,
      notes: [{ tag: "finding", text: "No light on the charger brick." }],
    });
    expect(prompt).toContain("diagnosing buddy");
    expect(prompt).toContain("terse, plain British English");
    expect(prompt).toContain("likelihood and by how cheap they are to test");
    expect(prompt).toContain("next 1 to 3 concrete tests");
    expect(prompt).toContain("what to measure or try");
    expect(prompt).toContain("what each result means");
    expect(prompt).toContain("one targeted clarifying question");
    expect(prompt).toContain("Never ask two questions");
    expect(prompt).toContain("If you are unsure");
    expect(prompt).toContain("what would settle it");
    expect(prompt).toContain("Never state a diagnosis as certain");
    expect(prompt).toContain("check the service manual / boardview");
    expect(prompt).toContain("mains");
    expect(prompt).toContain("swollen batteries");
    expect(prompt).toContain("capacitors");
    expect(prompt).toContain("liquid damage");
    expect(prompt).toContain("diagnostics are free");
    expect(prompt).toContain("£49");
    expect(prompt).toContain("£45");
    expect(prompt).toContain("Never quote a repair price you cannot back");
    expect(prompt).toContain("You must not message a customer");
    expect(prompt).toContain("You never receive a customer phone number");
    expect(prompt).toContain("must never reveal one");
    expect(prompt).toContain("You cannot create a job");
    expect(prompt).toContain("LL-4K7M");
    expect(prompt).not.toContain("Ada Lovelace");
    expect(prompt).not.toContain("Customer:");
    expect(prompt).toContain("No power");
    expect(prompt).toContain("finding (Finding)");
    expect(prompt).toContain("Status: diagnosing (Diagnosing)");
    expect(prompt).toContain("Parts: none on the notes.");
    expect(prompt).toContain("Job price: none.");
    expect(prompt).toContain("Seen anything like this before?");
    expect(prompt).toContain("where do I start?");
    expect(prompt).toContain("I'm lost");
    expect(prompt).toContain("one or two short sentences");
    expect(prompt).toContain("first one or two concrete checks");
    expect(prompt).toContain("Never ask permission to search");
    expect(prompt).toContain("nothing matches");
    expect(prompt).toContain("one short question");
    expect(prompt).toContain("hardware or BIOS");
    expect(prompt).toContain("waiting on the logic board");
    expect(prompt).toContain("same brand");
    expect(prompt).toContain("same fault on other models");
    expect(prompt).toContain("One question in a reply at most");
    expect(prompt).not.toContain(PHONE);
    expect(prompt).not.toContain("Do not diagnose");
    expect(prompt).not.toContain("He talks; you file");
    expect(prompt).not.toContain(WORKSHOP_RECORD_INSTRUCTIONS);
    expect(DEFAULT_ASSISTANT_MODEL).toBe("gpt-4.1");
  });

  it("gives the parts total and the part name when the job is waiting on a board", () => {
    const prompt = buildSystemPrompt({
      ref: "LL-HPS3",
      customerName: "Emily Duggins",
      deviceLabel: "Dell G15",
      reportedFault: "No power",
      status: "waiting_on_parts",
      nextMove: "Diagnose the reported fault",
      priceGbp: 239,
      priceBasis: "estimate",
      priceAgreedAt: null,
      notes: [{ tag: "parts", text: "Placeholder logic board - £239", amountGbp: null }],
    });
    expect(prompt).toContain("Status: waiting_on_parts (Waiting on parts)");
    expect(prompt).not.toContain("Emily Duggins");
    expect(prompt).toContain("Parts total £239 (1 part): Placeholder logic board");
    expect(prompt).toContain("Job price: £239, estimate, not agreed.");
    expect(prompt).toContain("waiting on the logic board");
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

  it("offers the job prompts on a job chat and the list prompts otherwise", () => {
    expect([...suggestionsFor("LL-4K7M")]).toEqual([...JOB_SUGGESTIONS]);
    expect(JOB_SUGGESTIONS).toEqual([
      "What should I test next?",
      "Summarise this job",
      "Seen anything like this before?",
    ]);
    expect([...suggestionsFor(null)]).toEqual([...LIST_SUGGESTIONS]);
    expect(LIST_SUGGESTIONS).toEqual(["Which jobs are waiting on me?", "Find jobs like..."]);
    expect(suggestionDraft("Find jobs like...")).toEqual({ send: false, text: "Find jobs like... " });
    expect(suggestionDraft("What should I test next?")).toEqual({
      send: true,
      text: "What should I test next?",
    });
  });
});

describe("save a reply to notes", () => {
  it("does not file unless he confirms, then files through record.ts with the chosen tag", async () => {
    const repo = new MemoryJobRepository();
    const job = await seed(repo, PHONE);
    expect(defaultSaveTag()).toBe("finding");
    const held = await saveAssistantFinding(repo, {
      ref: job.ref,
      text: "Likely the DC jack. 20V in, 0V at the jack.",
      tag: "parts",
      confirmed: false,
      clientRequestId: "asst-save-held-0001",
      now: new Date(NOW),
    });
    expect(held.ok).toBe(false);
    expect(repo.notes).toHaveLength(0);

    const unknown = await saveAssistantFinding(repo, {
      ref: job.ref,
      text: "Could be the board.",
      tag: "hypothesis",
      confirmed: true,
      clientRequestId: "asst-save-tag-0001",
      now: new Date(NOW),
    });
    expect(unknown.ok).toBe(false);
    expect(repo.notes).toHaveLength(0);

    const spy = vi.spyOn(record, "fileNote");
    const saved = await saveAssistantFinding(repo, {
      ref: job.ref,
      text: "Likely the DC jack. 20V in, 0V at the jack.",
      tag: "finding",
      confirmed: true,
      clientRequestId: "asst-save-note-0001",
      now: new Date(NOW),
    });
    expect(saved.ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(repo.notes).toHaveLength(1);
    expect(repo.notes[0]?.tag).toBe("finding");
    expect(repo.notes[0]?.text).toBe("Likely the DC jack. 20V in, 0V at the jack.");
    expect(repo.notes[0]?.jobId).toBe(job.id);
    expect(repo.jobs[0]?.phone).toBe(PHONE_DIGITS);
    expect(repo.jobs[0]?.status).toBe("diagnosing");
    expect(saved.ok && saved.value.statusMove).toEqual({ applied: true, from: "new", to: "diagnosing" });
    spy.mockRestore();

    const chat = readFileSync("src/app/ask/chat.tsx", "utf8");
    const action = readFileSync("src/app/ask/actions.ts", "utf8");
    expect(chat).toContain("Save to notes");
    expect(chat).toContain("Nothing is filed until you tap Save.");
    expect(chat).toContain("confirmSave");
    expect(chat).toContain("scopeRef");
    expect(action).toContain("confirmed: true");
    expect(action).toContain("saveAssistantFinding");
    expect(readFileSync("src/lib/bench/notes.ts", "utf8")).toContain('from "@/lib/jobs/record"');
  });
});
