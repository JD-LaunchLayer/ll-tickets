import type { NoteTag } from "@/lib/jobs/domain";

/**
 * Display rules for the notes feed. Pure functions only.
 * Not imported by the assistant, the Action API or any route handler.
 */

export type NoteMoneyInput = {
  tag: NoteTag | string | null;
  text: string;
  amountGbp: number | null;
};

export type NoteHeadlineInput = {
  text: string;
  summary?: string | null;
};

export type PartsSummary = {
  pence: number;
  count: number;
};

export type InlineRun = {
  bold: boolean;
  text: string;
};

export type NoteListItem = {
  lines: InlineRun[][];
};

export type NoteBlock =
  | { type: "p"; runs: InlineRun[] }
  | { type: "heading"; text: string }
  | { type: "ol"; start: number; items: NoteListItem[] }
  | { type: "ul"; items: NoteListItem[] };

const AMOUNT_RE = /£\s?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?/g;
const LIST_MARKER = /^(?:(\d{1,2})[.)]|([-*•–]))[ \t]+([\s\S]+)$/;
const HEADING_HASH = /^#{1,3}[ \t]+/;
const ABBREVIATION = /(?:^|[\s(])(e\.g|i\.e|approx|no|vs)$/i;

export const NOTE_OPEN_LIMIT = 200;
export const NOTE_OPEN_PREFIX = "ll-note-open:";

export function noteOpenKey(jobRef: string): string {
  return `${NOTE_OPEN_PREFIX}${jobRef}`;
}

export function formatPence(pence: number): string {
  const negative = pence < 0;
  const abs = Math.abs(Math.round(pence));
  const pounds = Math.floor(abs / 100);
  const frac = abs % 100;
  const grouped = String(pounds).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = frac === 0 ? grouped : `${grouped}.${String(frac).padStart(2, "0")}`;
  return `${negative ? "-" : ""}£${body}`;
}

function parsePoundsToken(raw: string): number | null {
  const cleaned = raw.replace(/£/g, "").replace(/\s/g, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  const pence = Number(whole) * 100 + Number(frac.padEnd(2, "0").slice(0, 2));
  return Number.isSafeInteger(pence) ? pence : null;
}

function amountTokens(line: string): { raw: string; pence: number; index: number }[] {
  const found: { raw: string; pence: number; index: number }[] = [];
  for (const match of line.matchAll(AMOUNT_RE)) {
    if (match.index === undefined) continue;
    const pence = parsePoundsToken(match[0]);
    if (pence === null) continue;
    found.push({ raw: match[0], pence, index: match.index });
  }
  return found;
}

/** Integer pence, or null when the note should not show a chip. */
export function noteAmount(note: NoteMoneyInput): number | null {
  if (note.amountGbp !== null && note.amountGbp !== undefined && Number.isFinite(note.amountGbp)) {
    return Math.round(note.amountGbp * 100);
  }
  if (note.tag !== "parts" && note.tag !== "quote_auth") return null;
  const first = note.text.split(/\r?\n/, 1)[0] ?? "";
  const tokens = amountTokens(first);
  if (tokens.length !== 1) return null;
  return tokens[0].pence;
}

/** Chip pence for Parts and Quote agreed only. A Finding that mentions £ never qualifies. */
export function noteChipPence(note: NoteMoneyInput): number | null {
  if (note.tag !== "parts" && note.tag !== "quote_auth") return null;
  return noteAmount(note);
}

export function partsSummary(notes: readonly NoteMoneyInput[]): PartsSummary {
  let pence = 0;
  let count = 0;
  for (const note of notes) {
    if (note.tag !== "parts") continue;
    const amount = noteAmount(note);
    if (amount === null) continue;
    pence += amount;
    count += 1;
  }
  return { pence, count };
}

const TRAILING_SEPARATORS = [" - ", " – ", " @ ", " for ", ":"] as const;

function stripTrailingSeparator(before: string): string | null {
  for (const separator of TRAILING_SEPARATORS) {
    if (before.endsWith(separator)) return before.slice(0, -separator.length);
  }
  return null;
}

function stripLeadingSeparator(after: string): string | null {
  for (const separator of TRAILING_SEPARATORS) {
    if (after.startsWith(separator)) return after.slice(separator.length);
  }
  return null;
}

function stripEdgeAmount(line: string, pence: number): string {
  const tokens = amountTokens(line).filter((token) => token.pence === pence);
  if (tokens.length === 0) return line;
  const last = tokens[tokens.length - 1];
  if (line.slice(last.index + last.raw.length).trim() === "") {
    const stripped = stripTrailingSeparator(line.slice(0, last.index));
    if (stripped !== null) return stripped.trim();
  }
  const first = tokens[0];
  if (line.slice(0, first.index).trim() === "") {
    const stripped = stripLeadingSeparator(line.slice(first.index + first.raw.length));
    if (stripped !== null) return stripped.trim();
  }
  return line;
}

/** Left-hand text of a Parts or Quote agreed note. Does not change the stored note. */
export function moneyDisplayText(note: NoteMoneyInput): string {
  const lines = note.text.split(/\r?\n/);
  let first = lines[0] ?? "";
  if (note.tag === "parts") {
    first = first.replace(/^(?:parts needed|ordered|part)\s*:\s*/i, "");
  }
  const chip = noteChipPence(note);
  if (chip !== null) first = stripEdgeAmount(first, chip);
  return [first, ...lines.slice(1)].join("\n");
}

function firstLine(text: string): string {
  return text.trim().split(/\r?\n/, 1)[0]?.trim() ?? "";
}

export function isCutoffSummary(summary: string, text: string): boolean {
  const line = firstLine(text);
  return summary.length >= 100 && line.startsWith(summary) && line.length > summary.length;
}

export function headlineWasAuthored(note: NoteHeadlineInput): boolean {
  const summary = note.summary?.trim() ?? "";
  return summary.length > 0 && !isCutoffSummary(summary, note.text);
}

function stripLead(line: string): string {
  let value = line.trim().replace(HEADING_HASH, "");
  const marker = LIST_MARKER.exec(value);
  if (marker) value = marker[3];
  return value.replace(/\*\*/g, "").trim();
}

function abbreviationBefore(before: string): boolean {
  return ABBREVIATION.test(before);
}

function betweenDigits(line: string, index: number): boolean {
  const prev = line[index - 1];
  const next = line[index + 1];
  return Boolean(prev && next && /\d/.test(prev) && /\d/.test(next));
}

function sentenceEnd(line: string): number {
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char !== "." && char !== "!" && char !== "?") continue;
    const next = index + 1 < line.length ? line[index + 1] : "";
    if (next !== "" && next !== " " && next !== "\t") continue;
    if (char === "." && betweenDigits(line, index)) continue;
    if (char === "." && abbreviationBefore(line.slice(0, index))) continue;
    return index + 1;
  }
  return -1;
}

function takeSentences(line: string): string {
  const firstEnd = sentenceEnd(line);
  if (firstEnd < 0) return line.trim();
  let sentence = line.slice(0, firstEnd).trim();
  const rest = line.slice(firstEnd).trim();
  if (sentence.length < 20 && rest) {
    const secondEnd = sentenceEnd(rest);
    const second = (secondEnd < 0 ? rest : rest.slice(0, secondEnd)).trim();
    sentence = `${sentence} ${second}`.trim();
  }
  return sentence;
}

function capHeadline(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 90) return trimmed;
  const head = trimmed.slice(0, 89);
  const space = head.lastIndexOf(" ");
  if (space <= 0) return `${trimmed.slice(0, 89)}…`;
  return `${head.slice(0, space).trimEnd()}…`;
}

function firstListItem(text: string): string | null {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let skipped = false;
  for (const line of lines) {
    if (!line.trim()) continue;
    if (!skipped) {
      skipped = true;
      continue;
    }
    const match = LIST_MARKER.exec(line.trim());
    if (!match) return null;
    return match[3].replace(/\*\*/g, "").trim();
  }
  return null;
}

function clipListItem(item: string): string {
  if (item.length <= 60) return item;
  return `${item.slice(0, 60).trimEnd()}…`;
}

/** Headline derived from the note text. At most 90 characters, one line. */
export function derivedHeadline(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const raw = lines.map((line) => line.trim()).find((line) => line.length > 0) ?? "";
  if (!raw) return "";
  const stripped = stripLead(raw);
  if (!stripped) return "";
  if (stripped.endsWith(":")) {
    const item = firstListItem(text);
    if (!item) return capHeadline(stripped);
    return capHeadline(`${stripped} ${clipListItem(item)}`);
  }
  return capHeadline(takeSentences(stripped));
}

export function noteHeadline(note: NoteHeadlineInput): string {
  const summary = note.summary?.trim() ?? "";
  if (summary && !isCutoffSummary(summary, note.text)) return summary;
  return derivedHeadline(note.text);
}

export function inlineRuns(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const pattern = /\*\*([^*\n]{1,80})\*\*/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) runs.push({ bold: false, text: text.slice(last, index) });
    runs.push({ bold: true, text: match[1] });
    last = index + match[0].length;
  }
  if (last < text.length) runs.push({ bold: false, text: text.slice(last) });
  return runs.filter((run) => run.text.length > 0);
}

function headingOf(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || LIST_MARKER.test(trimmed)) return null;
  const hash = HEADING_HASH.test(trimmed);
  const wrapped = /^\*\*[^*\n]{1,80}\*\*$/.test(trimmed);
  const bare = trimmed.replace(/\*\*/g, "").replace(HEADING_HASH, "").trim();
  const colon = bare.endsWith(":");
  if (!hash && !wrapped && !colon) return null;
  const content = bare.replace(/:$/, "").trim();
  if (!content || content.length > 60) return null;
  return bare;
}

function indentWidth(raw: string): number {
  const match = /^[ \t]*/.exec(raw);
  return match ? match[0].replace(/\t/g, "    ").length : 0;
}

/**
 * Paragraphs, headings and lists. Throws nothing for ordinary text.
 * Empty input yields no blocks; the renderer then falls back to pre-wrap.
 */
export function parseNoteBody(text: string): NoteBlock[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const blocks: NoteBlock[] = [];
  let paragraph: string[] = [];
  let list: { type: "ul" | "ol"; start: number; indent: number; items: NoteListItem[] } | null = null;

  function flushParagraph() {
    const joined = paragraph.join(" ").replace(/[ \t]+/g, " ").trim();
    paragraph = [];
    if (joined) blocks.push({ type: "p", runs: inlineRuns(joined) });
  }

  function flushList() {
    if (!list || list.items.length === 0) {
      list = null;
      return;
    }
    if (list.type === "ol") blocks.push({ type: "ol", start: list.start, items: list.items });
    else blocks.push({ type: "ul", items: list.items });
    list = null;
  }

  for (const raw of lines) {
    if (!raw.trim()) {
      flushList();
      flushParagraph();
      continue;
    }
    const indent = indentWidth(raw);
    const marker = LIST_MARKER.exec(raw.trim());
    if (list && indent > list.indent) {
      const extra = marker ? marker[3].trim() : raw.trim();
      const item = list.items[list.items.length - 1];
      if (item) item.lines.push(inlineRuns(extra));
      continue;
    }
    if (marker?.[1]) {
      flushParagraph();
      const start = Number(marker[1]);
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", start, indent, items: [] };
      }
      list.items.push({ lines: [inlineRuns(marker[3].trim())] });
      continue;
    }
    if (marker?.[2]) {
      flushParagraph();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", start: 1, indent, items: [] };
      }
      list.items.push({ lines: [inlineRuns(marker[3].trim())] });
      continue;
    }
    flushList();
    const heading = headingOf(raw);
    if (heading) {
      flushParagraph();
      blocks.push({ type: "heading", text: heading });
      continue;
    }
    paragraph.push(raw.trim());
  }
  flushList();
  flushParagraph();
  return blocks;
}

export function isLongNote(text: string): boolean {
  if (text.trim().length > 140) return true;
  if (/[\r\n]/.test(text)) return true;
  return parseNoteBody(text).some((block) => block.type === "ol" || block.type === "ul");
}

/** Text of the blocks, without list numbers, so a loss check can ignore markers. */
export function blocksPlainText(blocks: readonly NoteBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.type === "heading") {
      parts.push(block.text);
      continue;
    }
    if (block.type === "p") {
      parts.push(block.runs.map((run) => run.text).join(""));
      continue;
    }
    for (const item of block.items) {
      for (const line of item.lines) parts.push(line.map((run) => run.text).join(""));
    }
  }
  return parts.join(" ");
}

export function comparableNoteText(text: string): string {
  const stripped = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => {
      const heading = headingOf(line);
      if (heading) return heading;
      return line.replace(/^[ \t]*(?:\d{1,2}[.)]|[-*•–])[ \t]+/, "");
    })
    .join("\n")
    .replace(/\*\*/g, "");
  return stripped.replace(/\s+/g, " ").trim();
}

function parseStoredIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function readNoteOpenIds(storage: Storage, jobRef: string): string[] {
  return parseStoredIds(storage.getItem(noteOpenKey(jobRef))).slice(-NOTE_OPEN_LIMIT);
}

export function writeNoteOpenIds(storage: Storage, jobRef: string, ids: readonly string[]): void {
  const clean = ids.filter((id) => typeof id === "string");
  storage.setItem(noteOpenKey(jobRef), JSON.stringify(clean));
  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(NOTE_OPEN_PREFIX)) keys.push(key);
  }
  const entries = keys.map((key) => ({ key, ids: parseStoredIds(storage.getItem(key)) }));
  let total = entries.reduce((sum, entry) => sum + entry.ids.length, 0);
  for (const entry of entries) {
    while (total > NOTE_OPEN_LIMIT && entry.ids.length > 0) {
      entry.ids.shift();
      total -= 1;
    }
    storage.setItem(entry.key, JSON.stringify(entry.ids));
  }
}

export type NoteOpenDetail = {
  jobRef: string;
  noteId: string;
  focus?: boolean;
};

let pendingFocus: { jobRef: string; noteId: string } | null = null;

export function takePendingNoteFocus(jobRef: string): string | null {
  if (pendingFocus?.jobRef !== jobRef) return null;
  const noteId = pendingFocus.noteId;
  pendingFocus = null;
  return noteId;
}

export function requestOpenNote(jobRef: string, noteId: string): void {
  if (typeof window === "undefined") return;
  const current = readNoteOpenIds(window.sessionStorage, jobRef);
  if (!current.includes(noteId)) writeNoteOpenIds(window.sessionStorage, jobRef, [...current, noteId]);
  pendingFocus = { jobRef, noteId };
  const detail: NoteOpenDetail = { jobRef, noteId, focus: true };
  window.dispatchEvent(new CustomEvent("ll-note-open", { detail }));
}
