import { describe, expect, it } from "vitest";
import { latestNote, latestNoteLabel } from "@/lib/bench/latest-note";
import {
  buildListQuery,
  jobPath,
  listPath,
  orderedJobRefs,
  parseFromQuery,
  placeAriaLabel,
  placeInList,
  placeLabel,
} from "@/lib/bench/list-place";
import { DEFAULT_NOTE_TAG, NOTE_TAG_OPTIONS } from "@/lib/bench/note-tag-options";
import { draftKey, draftLauncherLabel, parseDraft } from "@/lib/bench/draft";
import { pendingPhrase } from "@/lib/bench/pending-phrase";

describe("list place", () => {
  const active = [{ ref: "LL-AAAA" }, { ref: "LL-BBBB" }, { ref: "LL-CCCC" }];
  const finished = [{ ref: "LL-DDDD" }];

  it("keeps active jobs ahead of finished jobs", () => {
    expect(orderedJobRefs(active, finished)).toEqual(["LL-AAAA", "LL-BBBB", "LL-CCCC", "LL-DDDD"]);
    expect(orderedJobRefs(active, [])).toEqual(["LL-AAAA", "LL-BBBB", "LL-CCCC"]);
  });

  it("finds neighbours and disables the ends", () => {
    const refs = orderedJobRefs(active, finished);
    expect(placeInList(refs, "LL-AAAA")).toEqual({
      index: 1,
      total: 4,
      previousRef: null,
      nextRef: "LL-BBBB",
    });
    expect(placeInList(refs, "LL-BBBB")).toEqual({
      index: 2,
      total: 4,
      previousRef: "LL-AAAA",
      nextRef: "LL-CCCC",
    });
    expect(placeInList(refs, "LL-DDDD")).toEqual({
      index: 4,
      total: 4,
      previousRef: "LL-CCCC",
      nextRef: null,
    });
    expect(placeInList(refs, "LL-GONE")).toBeNull();
  });

  it("announces the position as job n of N", () => {
    const place = placeInList(["LL-J758", "LL-9XHT"], "LL-J758");
    expect(place).not.toBeNull();
    expect(placeLabel(place!)).toBe("1 of 2");
    expect(placeAriaLabel(place!)).toBe("Job 1 of 2");
  });

  it("round-trips the list query on the job URL", () => {
    const query = buildListQuery("parts", true, " ada ");
    expect(query).toBe("q=ada&view=parts&finished=1");
    expect(listPath(query)).toBe("/?q=ada&view=parts&finished=1");
    expect(listPath("")).toBe("/");
    expect(jobPath("LL-J758", query)).toBe("/jobs/LL-J758?from=q%3Dada%26view%3Dparts%26finished%3D1");
    expect(parseFromQuery(query)).toEqual({
      q: "ada",
      view: "parts",
      finished: true,
      raw: query,
    });
    expect(parseFromQuery(undefined)).toEqual({ q: "", view: "bench", finished: false, raw: "" });
    expect(parseFromQuery("view=nope").view).toBe("bench");
    expect(jobPath("LL-J758", "")).toBe("/jobs/LL-J758?from=");
  });
});

describe("latest note", () => {
  const notes = [
    { id: "new-parts", tag: "parts", text: "Ordered a battery" },
    { id: "finding", tag: "finding", text: "DC jack is loose" },
    { id: "old", tag: "other", text: "Earlier note" },
  ];

  it("prefers the newest finding, then any note, then empty", () => {
    expect(latestNote(notes)).toEqual({ kind: "finding", note: notes[1] });
    expect(latestNoteLabel("finding")).toBe("Latest finding");
    const without = notes.filter((note) => note.tag !== "finding");
    expect(latestNote(without)).toEqual({ kind: "note", note: without[0] });
    expect(latestNoteLabel("note")).toBe("Latest note");
    expect(latestNote([])).toEqual({ kind: "empty" });
    expect(latestNoteLabel("empty")).toBe("Latest finding");
  });
});

describe("pending phrase", () => {
  it("adds still working only after the action has been pending", () => {
    expect(pendingPhrase(false, false, "Filing…", "File note")).toBe("File note");
    expect(pendingPhrase(false, true, "Filing…", "File note")).toBe("File note");
    expect(pendingPhrase(true, false, "Filing…", "File note")).toBe("Filing…");
    expect(pendingPhrase(true, true, "Filing…", "File note")).toBe("Filing… still working");
    expect(pendingPhrase(true, true, "Creating…", "Create job")).toBe("Creating… still working");
  });
});

describe("note draft", () => {
  it("keeps a per-job draft and shows it on the launcher", () => {
    expect(draftKey("LL-J758")).toBe("ll-draft:LL-J758");
    expect(parseDraft(null)).toEqual({ text: "", tag: "finding" });
    expect(parseDraft("{\"text\":\"Loose jack\",\"tag\":\"parts\"}")).toEqual({ text: "Loose jack", tag: "parts" });
    expect(parseDraft("nope")).toEqual({ text: "", tag: "finding" });
    expect(draftLauncherLabel("  ")).toBe("Add a note…");
    expect(draftLauncherLabel("Loose\njack")).toBe("Draft: Loose jack");
  });
});

describe("note tag options", () => {
  it("lists six tags then Untagged, and defaults to Finding", () => {
    expect(NOTE_TAG_OPTIONS.map((option) => option.label)).toEqual([
      "Finding",
      "Work done",
      "Parts",
      "Customer contact",
      "Quote agreed",
      "Other",
      "Untagged",
    ]);
    expect(NOTE_TAG_OPTIONS.map((option) => option.value)).toEqual([
      "finding",
      "work_done",
      "parts",
      "customer_contact",
      "quote_auth",
      "other",
      "",
    ]);
    expect(DEFAULT_NOTE_TAG).toBe("finding");
  });
});
