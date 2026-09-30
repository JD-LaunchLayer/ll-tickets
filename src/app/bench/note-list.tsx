"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ChevronIcon } from "@/app/bench/icons";
import { NoteBody } from "@/app/bench/note-blocks";
import { formatBenchTime } from "@/lib/bench/format";
import {
  emptyFilterMessage,
  filterChipAriaLabel,
  filterChipShowsCount,
  filterNotes,
  noteCounts,
  noteFilterKey,
  noteJumpKey,
  parseNoteFilter,
  shownAboveId,
  type NoteFilterId,
} from "@/lib/bench/now-next";
import {
  formatPence,
  headlineWasAuthored,
  isLongNote,
  moneyDisplayText,
  noteChipPence,
  noteHeadline,
  noteOpenKey,
  partsSummary,
  readNoteOpenIds,
  takePendingNoteFocus,
  writeNoteOpenIds,
  type NoteOpenDetail,
} from "@/lib/bench/note-view";
import { NOTE_TAG_LABELS, type NoteTag } from "@/lib/jobs/domain";

export type NoteRow = {
  id: string;
  text: string;
  tag: NoteTag | null;
  createdAt: string;
  editedAt: string | null;
  summary: string;
  amountGbp: number | null;
  partDetail: string | null;
  clientRequestId: string;
};

const NO_OPEN: string[] = [];

function tagLabel(tag: NoteTag | null): string {
  return tag ? NOTE_TAG_LABELS[tag] : "Untagged";
}

function NoteTypeIcon({ tag }: { tag: NoteTag | null }) {
  const quote = tag === "quote_auth";
  return (
    <svg
      className={quote ? "note-type-icon note-type-icon-quote" : "note-type-icon"}
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <NoteGlyph tag={tag} />
    </svg>
  );
}

function NoteGlyph({ tag }: { tag: NoteTag | null }) {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (tag === "finding") {
    return (
      <>
        <circle {...stroke} cx="10.5" cy="10.5" r="5.5" />
        <path {...stroke} d="m14.5 14.5 4 4" />
      </>
    );
  }
  if (tag === "parts") {
    return (
      <>
        <rect {...stroke} x="7" y="7" width="10" height="10" rx="1.5" />
        <path {...stroke} d="M9 7V4.5M12 7V4.5M15 7V4.5M9 19.5V17M12 19.5V17M15 19.5V17M7 9.5H4.5M7 14.5H4.5M19.5 9.5H17M19.5 14.5H17" />
      </>
    );
  }
  if (tag === "quote_auth") {
    return (
      <>
        <circle {...stroke} cx="12" cy="12" r="8" />
        <path {...stroke} d="m8.2 12.2 2.4 2.4 5.2-5.4" />
      </>
    );
  }
  if (tag === "customer_contact") {
    return (
      <>
        <circle {...stroke} cx="12" cy="9" r="3" />
        <path {...stroke} d="M6.5 18.5a5.5 5.5 0 0 1 11 0" />
      </>
    );
  }
  if (tag === "work_done") {
    return (
      <>
        <path {...stroke} d="M14.5 6.5a3 3 0 0 0-4.2 4.2L4.8 16.2 7.8 19.2 13.3 13.7a3 3 0 0 0 4.2-4.2L15 12l-3-3 2.5-2.5z" />
      </>
    );
  }
  return (
    <>
      <path {...stroke} d="M7 4.5h7l4 4V19.5H7z" />
      <path {...stroke} d="M14 4.5v4h4" />
    </>
  );
}

function useOpenIds(jobRef: string): string[] {
  const cache = useRef<{ key: string; raw: string; ids: string[] }>({ key: "", raw: "", ids: NO_OPEN });
  return useSyncExternalStore(
    (onChange) => {
      const handler = () => onChange();
      window.addEventListener("ll-note-open", handler);
      return () => window.removeEventListener("ll-note-open", handler);
    },
    () => {
      const raw = sessionStorage.getItem(noteOpenKey(jobRef)) ?? "";
      if (cache.current.key === jobRef && cache.current.raw === raw) return cache.current.ids;
      const ids = readNoteOpenIds(sessionStorage, jobRef);
      cache.current = { key: jobRef, raw, ids };
      return ids;
    },
    () => NO_OPEN,
  );
}

function ExpanderCaption({ open }: { open: boolean }) {
  return (
    <span className="note-expander-caption">
      {open ? "Hide full note" : "Show full note"}
      <ChevronIcon direction="down" className="icon note-feed-chevron" />
    </span>
  );
}

const FILTERS: Array<{ id: NoteFilterId; label: string }> = [
  { id: "all", label: "All" },
  { id: "finding", label: "Findings" },
  { id: "parts", label: "Parts" },
  { id: "contact", label: "Contact" },
];

function useNoteFilter(jobRef: string): NoteFilterId {
  return useSyncExternalStore(
    (onChange) => {
      const handler = () => onChange();
      window.addEventListener("ll-note-filter", handler);
      return () => window.removeEventListener("ll-note-filter", handler);
    },
    () => {
      try {
        return parseNoteFilter(sessionStorage.getItem(noteFilterKey(jobRef)));
      } catch {
        return "all";
      }
    },
    () => "all",
  );
}

function writeFilter(jobRef: string, filter: NoteFilterId) {
  sessionStorage.setItem(noteFilterKey(jobRef), filter);
  window.dispatchEvent(new Event("ll-note-filter"));
}

export function NoteList({
  jobRef,
  notes,
  latestNoteId,
}: {
  jobRef: string;
  notes: NoteRow[];
  latestNoteId?: string | null;
}) {
  const openIds = useOpenIds(jobRef);
  const filter = useNoteFilter(jobRef);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [dropCounts, setDropCounts] = useState(false);
  const chipsRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<Partial<Record<NoteFilterId, HTMLButtonElement | null>>>({});
  const shownId = latestNoteId === undefined ? shownAboveId(notes) : latestNoteId;
  const counts = noteCounts(notes);
  const visible = filterNotes(notes, filter);
  const parts = partsSummary(notes);

  useEffect(() => {
    let timer = 0;
    const apply = () => {
      if (sessionStorage.getItem("ll-fresh") !== jobRef) return;
      writeFilter(jobRef, "all");
      setFreshId(notes[0]?.id ?? null);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        sessionStorage.removeItem("ll-fresh");
        setFreshId(null);
      }, 2000);
    };
    const start = window.setTimeout(apply, 0);
    window.addEventListener("ll-note-filed", apply);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(timer);
      window.removeEventListener("ll-note-filed", apply);
    };
  }, [jobRef, notes]);

  useEffect(() => {
    const id = takePendingNoteFocus(jobRef);
    if (!id) return;
    document.getElementById(`note-${id}`)?.querySelector<HTMLElement>("[data-note-hide]")?.focus();
  }, [openIds, jobRef]);

  useEffect(() => {
    const jump = sessionStorage.getItem(noteJumpKey(jobRef));
    if (!jump) return;
    sessionStorage.removeItem(noteJumpKey(jobRef));
    const row = document.getElementById(`note-${jump}`);
    if (row && typeof row.scrollIntoView === "function") row.scrollIntoView({ block: "nearest" });
  }, [filter, jobRef, shownId]);

  useEffect(() => {
    if (dropCounts) return;
    const group = chipsRef.current;
    if (!group || window.innerWidth > 360) return;
    const overflow = [...group.querySelectorAll<HTMLElement>("[role='radio']")].some(
      (chip) => chip.scrollWidth > chip.clientWidth + 1,
    );
    if (overflow) setDropCounts(true);
  }, [dropCounts, notes, filter]);

  function toggle(id: string) {
    const current = readNoteOpenIds(sessionStorage, jobRef);
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    writeNoteOpenIds(sessionStorage, jobRef, next);
    window.dispatchEvent(new CustomEvent<NoteOpenDetail>("ll-note-open", { detail: { jobRef, noteId: id } }));
  }

  function onFilterKey(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = FILTERS.findIndex((item) => item.id === filter);
    let next = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % FILTERS.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + FILTERS.length) % FILTERS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = FILTERS.length - 1;
    else return;
    event.preventDefault();
    const id = FILTERS[next]?.id;
    if (!id) return;
    writeFilter(jobRef, id);
    chipRefs.current[id]?.focus();
  }

  if (notes.length === 0) {
    return <p className="muted">No notes yet. Add the first one below.</p>;
  }

  const empty = emptyFilterMessage(filter);
  const partWord = parts.count === 1 ? "1 part" : `${parts.count} parts`;

  return (
    <>
      <div
        ref={chipsRef}
        className="filter-chips"
        role="radiogroup"
        aria-label="Filter notes"
        onKeyDown={onFilterKey}
      >
        {FILTERS.map((item) => {
          const selected = filter === item.id;
          const count = counts[item.id];
          const showCount = filterChipShowsCount(count) && !dropCounts;
          return (
            <button
              key={item.id}
              ref={(node) => {
                chipRefs.current[item.id] = node;
              }}
              type="button"
              className="filter-chip"
              role="radio"
              aria-checked={selected}
              aria-label={filterChipAriaLabel(item.label, count)}
              tabIndex={selected ? 0 : -1}
              onClick={() => writeFilter(jobRef, item.id)}
            >
              <span className="filter-chip-label">{item.label}</span>
              {showCount ? (
                <span className="filter-count" aria-hidden="true">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">
        {`Showing ${visible.length} of ${notes.length} notes`}
      </p>
      {filter === "parts" ? (
        <p className="parts-total">
          <span>Parts total</span>
          <span className="money-chip">{formatPence(parts.pence)}</span>
          <span>· {partWord}</span>
        </p>
      ) : null}
      {visible.length === 0 && empty ? (
        <div className="filter-empty">
          <p aria-live="polite">{empty}</p>
          <button type="button" className="tech-btn-quiet" onClick={() => writeFilter(jobRef, "all")}>
            Show all notes
          </button>
        </div>
      ) : (
        <ul className="timeline">
          {visible.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              fresh={note.id === freshId}
              open={openIds.includes(note.id)}
              shown={note.id === shownId}
              onToggle={() => toggle(note.id)}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function NoteItem({
  note,
  fresh,
  open,
  shown,
  onToggle,
}: {
  note: NoteRow;
  fresh: boolean;
  open: boolean;
  shown: boolean;
  onToggle: () => void;
}) {
  const long = isLongNote(note.text);
  const finding = note.tag === "finding";
  const chip = noteChipPence(note);
  const headline = noteHeadline(note);
  const authored = headlineWasAuthored(note);
  const fromAsk = note.clientRequestId.startsWith("asst");
  const detailId = `note-${note.id}-detail`;
  const findingClass = finding ? " note-finding" : "";
  const shownClass = shown && !long ? " note-shown-body" : "";

  return (
    <li id={`note-${note.id}`} className={fresh ? "note-row note-fresh" : "note-row"}>
      <div className="note-meta">
        <span className="note-type">
          <NoteTypeIcon tag={note.tag} />
          <span className="note-type-label">{tagLabel(note.tag)}</span>
          {fromAsk ? <span className="note-ask">· from Ask</span> : null}
          {shown ? <span className="note-shown-mark">· shown above</span> : null}
        </span>
        <span className="note-meta-end">
          {long && chip !== null ? <span className="money-chip">{formatPence(chip)}</span> : null}
          <time dateTime={note.createdAt}>{formatBenchTime(note.createdAt)}</time>
        </span>
      </div>
      {long ? (
        <>
          <button
            type="button"
            className="note-expander"
            aria-expanded={open}
            aria-controls={detailId}
            data-note-hide={open ? "true" : undefined}
            onClick={onToggle}
          >
            {open ? (
              <ExpanderCaption open />
            ) : (
              <>
                <span className={`note-headline${findingClass}`}>{headline}</span>
                <ExpanderCaption open={false} />
              </>
            )}
          </button>
          {open && authored ? <p className={`note-authored${findingClass}`}>{headline}</p> : null}
          <div className={open ? "note-detail-wrap is-open" : "note-detail-wrap"}>
            <div id={detailId} className="note-detail" inert={open ? undefined : true}>
              <NoteBody text={note.text} lead={!authored} />
            </div>
          </div>
          {open && note.text.length > 600 ? (
            <button
              type="button"
              className="note-expander"
              aria-expanded="true"
              aria-controls={detailId}
              data-note-hide="true"
              onClick={onToggle}
            >
              <ExpanderCaption open />
            </button>
          ) : null}
        </>
      ) : chip !== null ? (
        <div className="note-money">
          <p className={`note-text${shownClass}`}>{moneyDisplayText(note)}</p>
          <span className="money-chip">{formatPence(chip)}</span>
        </div>
      ) : (
        <p className={`note-text${findingClass}${shownClass}`}>{note.text}</p>
      )}
      {note.editedAt ? <p className="note-edited">Edited {formatBenchTime(note.editedAt)}</p> : null}
    </li>
  );
}
