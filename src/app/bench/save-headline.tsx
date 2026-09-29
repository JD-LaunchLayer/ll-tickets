import { derivedHeadline } from "@/lib/bench/note-view";

/** Read-only line under the Save to notes field. Updates with the draft. */
export function SaveHeadline({ text }: { text: string }) {
  const headline = derivedHeadline(text);
  if (!text.trim() || !headline) return null;
  return <p className="save-headline">Headline: {headline}</p>;
}
