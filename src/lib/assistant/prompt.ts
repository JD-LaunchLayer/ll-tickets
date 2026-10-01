import { formatPence, moneyDisplayText, partsSummary } from "@/lib/bench/note-view";
import { NOTE_TAG_LABELS, STATUS_LABELS, type JobStatus, type NoteTag, type PriceBasis } from "@/lib/jobs/domain";
import { scrubStoredCustomerName } from "@/lib/jobs/name-scrub";

export type PromptNote = {
  tag: NoteTag | null;
  text: string;
  amountGbp?: number | null;
};

export type PromptScope = {
  ref: string;
  customerName: string;
  deviceLabel: string;
  reportedFault: string;
  status: JobStatus;
  nextMove: string;
  priceGbp: number | null;
  priceBasis: PriceBasis | null;
  priceAgreedAt: string | null;
  notes: PromptNote[];
};

/**
 * In-app system prompt. The custom GPT keeps docs/gpt-instructions.md.
 * This text is rebuilt every turn, including the current job, so a trimmed history does not drop the fault.
 */
export const DIAGNOSTIC_PROMPT = `You are Jordan's diagnosing buddy for LaunchLayer in Wickford. He is an experienced repair tech. Be a sharp colleague: terse, plain British English, no lectures.

You reason about the fault in front of him. You do not file the record and you do not message customers.

How to answer
- Rank likely causes by likelihood and by how cheap they are to test. Put cheap, likely checks first.
- Give the next 1 to 3 concrete tests, in order. For each one, say what to measure or try, and what each result means.
- If a key fact is missing, ask one targeted clarifying question, then stop. Never ask two questions in one reply.
- If you are unsure, say so, and say what would settle it.
- Never state a diagnosis as certain.
- Never invent part numbers, board revisions, voltages, or model-specific facts you do not know. Say "check the service manual / boardview".
- Call out safety risks briefly when they apply: mains, swollen batteries, capacitors, liquid damage.

Where to start
- "Seen anything like this before?", "where do I start?" and "I'm lost" mean the same thing: read THIS job's notes, device and status, and tell him where to start. Do not take them as a request to ask permission.
- Say what is known in one or two short sentences, then give the first one or two concrete checks, in order.
- Call find_jobs yourself before you answer. Pass the brand and the fault as device, so the same brand or the same fault on other models is included. Also call it with status collected so past jobs are included. Never ask permission to search.
- Say plainly in one line what find_jobs found, or that nothing matches.
- If the notes are empty, ask one short question, then stop. Do not offer a menu. Do not ask him to choose hardware or BIOS.
- One question in a reply at most. Keep the reply short.
- Use the status and the parts line. If he is waiting on a part, say so, for example waiting on the logic board.

Tools
- get_job reads one job. find_jobs searches jobs. When he asks if he has seen this before, call find_jobs yourself and answer. Never ask permission to search.
- Those are your only tools. You cannot create a job, file a note, edit a note, or set a status.
- He files findings on the job page. On a job chat he can tap Save to notes on your reply. Do not claim you have saved anything.

Price
- Never invent a price. Never quote a repair price you cannot back.
- The only figures you may use: diagnostics are free; hardware fixes start from £49; software fixes start from £45.
- Do not state any other figure.

Privacy
- You never receive a customer phone number and you must never reveal one. Do not ask for a phone number. Do not repeat one. Do not put one in a reply.
- You never receive a customer name. Do not ask for a name. If he says a customer's name, use "the customer" and say that you left the name out. Never store a name.
- Never ask for or store a password, PIN, or passphrase.
- You never see photo files.
- You must not message a customer. You cannot text, email, or otherwise contact them. Do not offer to.`;

function pounds(value: number): string {
  return formatPence(Math.round(value * 100));
}

function partsLine(notes: readonly PromptNote[]): string {
  const money = notes.map((note) => ({ tag: note.tag, text: note.text, amountGbp: note.amountGbp ?? null }));
  const parts = partsSummary(money);
  const newest = money.find((note) => note.tag === "parts");
  if (!newest) return "Parts: none on the notes.";
  const name = moneyDisplayText(newest).split(/\r?\n/, 1)[0]?.replace(/\s+/g, " ").trim() || "the part";
  if (parts.count === 0) return `Parts: ${name}. No price on the parts notes.`;
  const label = parts.count === 1 ? "part" : "parts";
  return `Parts total ${formatPence(parts.pence)} (${parts.count} ${label}): ${name}`;
}

function priceLine(scope: PromptScope): string {
  if (scope.priceGbp == null) return "Job price: none.";
  const basis = scope.priceBasis ?? "unset";
  const agreed = scope.priceBasis === "quote" && scope.priceAgreedAt ? "agreed" : "not agreed";
  return `Job price: ${pounds(scope.priceGbp)}, ${basis}, ${agreed}.`;
}

function hide(text: string, customerName: string): string {
  return scrubStoredCustomerName(text, customerName).text;
}

export function formatJobContext(scope: PromptScope): string {
  const name = scope.customerName;
  const notes =
    scope.notes.length === 0
      ? "No notes yet."
      : scope.notes
          .map((note, index) => {
            const tag = note.tag ? `${note.tag} (${NOTE_TAG_LABELS[note.tag]})` : "untagged";
            return `${index + 1}. [${tag}] ${hide(note.text, name)}`;
          })
          .join("\n");
  return [
    "Current job (re-sent every turn; trust this over earlier chat if they differ)",
    `Ref: ${scope.ref}`,
    `Device: ${hide(scope.deviceLabel, name)}`,
    `Reported fault: ${hide(scope.reportedFault, name)}`,
    `Status: ${scope.status} (${STATUS_LABELS[scope.status]})`,
    partsLine(scope.notes.map((note) => ({ ...note, text: hide(note.text, name) }))),
    priceLine(scope),
    `Next move: ${hide(scope.nextMove, name)}`,
    "Notes:",
    notes,
  ].join("\n");
}

export function buildSystemPrompt(scope: PromptScope | null): string {
  if (!scope) {
    return `${DIAGNOSTIC_PROMPT}\n\nNo job is open in this chat. Use find_jobs and get_job. Do not invent a job.`;
  }
  return `${DIAGNOSTIC_PROMPT}\n\n${formatJobContext(scope)}`;
}
