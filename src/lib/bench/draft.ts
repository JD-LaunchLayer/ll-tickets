import { DEFAULT_NOTE_TAG } from "@/lib/bench/note-tag-options";

export function draftKey(ref: string): string {
  return `ll-draft:${ref}`;
}

export type NoteDraft = { text: string; tag: string };

export function emptyDraft(): NoteDraft {
  return { text: "", tag: DEFAULT_NOTE_TAG };
}

export function parseDraft(raw: string | null): NoteDraft {
  if (!raw) return emptyDraft();
  try {
    const parsed = JSON.parse(raw) as { text?: unknown; tag?: unknown };
    return {
      text: typeof parsed.text === "string" ? parsed.text : "",
      tag: typeof parsed.tag === "string" ? parsed.tag : DEFAULT_NOTE_TAG,
    };
  } catch {
    return emptyDraft();
  }
}

/** Single line for the bottom bar. Blank drafts keep the placeholder. */
export function draftLauncherLabel(text: string): string {
  const flat = text.trim().replace(/\s+/g, " ");
  return flat ? `Draft: ${flat}` : "Add a note…";
}
