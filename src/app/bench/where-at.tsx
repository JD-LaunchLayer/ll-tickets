"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { setStatusAction } from "@/app/bench/actions";
import { ErrorPanel } from "@/app/bench/error-panel";
import { ChevronIcon } from "@/app/bench/icons";
import { useOffline } from "@/app/bench/providers";
import { Sheet } from "@/app/bench/sheet";
import { SaveToast } from "@/app/bench/toast";
import { usePendingPhrase } from "@/app/bench/use-pending-phrase";
import { idleForm } from "@/lib/bench/form-state";
import { formatPence, requestOpenNote } from "@/lib/bench/note-view";
import {
  displayNextMove,
  noteFilterKey,
  noteJumpKey,
  noteVisibleInFilter,
  parseNoteFilter,
  type DisplayNextMove,
} from "@/lib/bench/now-next";
import { JOB_STATUSES, NOTE_TAG_LABELS, STATUS_LABELS, type JobStatus, type NoteTag } from "@/lib/jobs/domain";

export function NowNext({
  jobRef,
  status,
  nextMove,
  suggestion,
  partsPence = 0,
  partsCount = 0,
  latestKind,
  latestText,
  latestTime,
  latestNoteId,
  latestTag,
}: {
  jobRef: string;
  status: JobStatus;
  nextMove: string;
  suggestion?: DisplayNextMove;
  partsPence?: number;
  partsCount?: number;
  latestKind: "finding" | "note" | "empty";
  latestText: string;
  latestTime: string | null;
  latestNoteId: string | null;
  latestTag?: NoteTag | null;
}) {
  const offline = useOffline();
  const shown =
    suggestion ??
    displayNextMove({
      status,
      nextMove,
      priceGbp: null,
      priceBasis: null,
      priceAgreedAt: null,
      notes: [],
    });
  const [statusOpen, setStatusOpen] = useState(false);
  const statusButton = useRef<HTMLButtonElement>(null);
  const currentStatus = useRef<HTMLButtonElement>(null);
  const [state, formAction, pending] = useActionState(setStatusAction, idleForm);
  const statusAction = shown.action?.type === "status" ? shown.action : null;
  const phrase = usePendingPhrase(pending, "Saving…", statusAction?.label ?? "Save");

  const closeStatus = useCallback(() => setStatusOpen(false), []);
  const kicker =
    latestKind === "finding" ? "Finding" : latestKind === "note" ? (latestTag ? NOTE_TAG_LABELS[latestTag] : "Untagged") : null;

  function openNote() {
    window.dispatchEvent(new CustomEvent("ll-open-note", { detail: { jobRef } }));
  }

  function scrollToNote() {
    if (!latestNoteId) return;
    let filter = "all";
    try {
      filter = parseNoteFilter(sessionStorage.getItem(noteFilterKey(jobRef)));
    } catch {
      filter = "all";
    }
    if (latestTag !== undefined && !noteVisibleInFilter(latestTag, parseNoteFilter(filter))) {
      try {
        sessionStorage.setItem(noteFilterKey(jobRef), "all");
        sessionStorage.setItem(noteJumpKey(jobRef), latestNoteId);
        window.dispatchEvent(new Event("ll-note-filter"));
      } catch {
        /* sessionStorage can be blocked; the note is still opened when it is already in the list. */
      }
    }
    requestOpenNote(jobRef, latestNoteId);
    const row = document.getElementById(`note-${latestNoteId}`);
    if (row && typeof row.scrollIntoView === "function") row.scrollIntoView({ block: "nearest" });
  }

  const partsLabel = partsCount === 1 ? "1 part" : `${partsCount} parts`;
  const partsMoney = formatPence(partsPence);

  return (
    <section className="now-next" aria-label="Now and next">
      <div className="now-status">
        <button ref={statusButton} type="button" className="now-status-hit" onClick={() => setStatusOpen(true)}>
          <span className={`status-pill status-${status}`}>{STATUS_LABELS[status]}</span>
        </button>
        {partsCount > 0 ? (
          <span className="money-chip" aria-label={`Parts total ${partsMoney}, ${partsLabel}`}>
            Parts {partsMoney}
          </span>
        ) : null}
        <span className="now-spacer" />
        <button type="button" className="now-icon" aria-label="Change status" onClick={() => setStatusOpen(true)}>
          <ChevronIcon direction="right" />
        </button>
      </div>
      {latestNoteId ? (
        <button type="button" className="now-finding" onClick={scrollToNote}>
          <span className="now-copy">
            <span className="now-kicker-row">
              <span className="where-kicker">{kicker}</span>
              {latestTime ? <span className="where-kicker">{latestTime}</span> : null}
            </span>
            <span className="now-headline">{latestText}</span>
          </span>
          <ChevronIcon direction="right" className="icon now-chevron" />
        </button>
      ) : (
        <div className="now-finding">
          <span className="now-headline now-headline-empty">No finding yet</span>
          <button type="button" className="now-add" onClick={openNote}>
            Add
          </button>
        </div>
      )}
      <div className="now-move">
        <span className="now-copy">
          <span className="where-kicker">Next</span>
          <span className="now-sentence clamp-2">{shown.text}</span>
        </span>
      </div>
      {statusAction ? (
        <form action={formAction} className="now-action">
          <input type="hidden" name="ref" value={jobRef} />
          <input type="hidden" name="status" value={statusAction.status} />
          <button className="tech-btn-primary" type="submit" disabled={pending || offline}>
            {phrase}
          </button>
        </form>
      ) : shown.action?.type === "note" ? (
        <div className="now-action">
          <button className="tech-btn-primary" type="button" onClick={openNote}>
            {shown.action.label}
          </button>
        </div>
      ) : null}
      <SaveToast message={state.notice} token={state.noticeId} />
      <StatusSheet
        open={statusOpen}
        jobRef={jobRef}
        status={status}
        currentRef={currentStatus}
        restoreRef={statusButton}
        onClose={closeStatus}
      />
    </section>
  );
}

/** Earlier name, kept so the notes-feed test can render the same block. */
export const WhereAt = NowNext;

function StatusSheet({
  open,
  jobRef,
  status,
  currentRef,
  restoreRef,
  onClose,
}: {
  open: boolean;
  jobRef: string;
  status: JobStatus;
  currentRef: React.RefObject<HTMLButtonElement | null>;
  restoreRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const offline = useOffline();
  const [state, action, pending] = useActionState(setStatusAction, idleForm);
  const phrase = usePendingPhrase(pending, "Saving…", "Save");
  const seen = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!state.noticeId || state.noticeId === seen.current) return;
    seen.current = state.noticeId;
    onClose();
  }, [state.noticeId, onClose]);

  return (
    <>
      <Sheet open={open} title="Status" onClose={onClose} initialFocusRef={currentRef} restoreFocusRef={restoreRef}>
        <form action={action} className="sheet-form">
          <input type="hidden" name="ref" value={jobRef} />
          <div className="radio-list" role="radiogroup" aria-label="Status">
            {JOB_STATUSES.map((value) => (
              <button
                key={value}
                ref={value === status ? currentRef : undefined}
                type="submit"
                name="status"
                value={value}
                className="radio-row"
                role="radio"
                aria-checked={value === status}
                disabled={pending || offline}
              >
                <span>{value === status && pending ? phrase : STATUS_LABELS[value]}</span>
                {value === status ? <span aria-hidden="true">✓</span> : null}
              </button>
            ))}
          </div>
          {state.error ? <ErrorPanel message={state.error} reason={state.reason} /> : null}
        </form>
      </Sheet>
      <SaveToast message={state.notice} token={state.noticeId} />
    </>
  );
}
