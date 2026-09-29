import { NOTE_TAGS, NOTE_TAG_LABELS } from "@/lib/jobs/domain";

/** Native select order. Untagged is an empty value, which the server already stores as no tag. */
export const NOTE_TAG_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  ...NOTE_TAGS.map((tag) => ({ value: tag, label: NOTE_TAG_LABELS[tag] })),
  { value: "", label: "Untagged" },
];

export const DEFAULT_NOTE_TAG = "finding";
