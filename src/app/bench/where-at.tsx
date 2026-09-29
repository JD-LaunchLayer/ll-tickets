"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { saveNextMoveAction, setStatusAction } from "@/app/bench/actions";
import { ErrorPanel } from "@/app/bench/error-panel";
import { ChevronIcon } from "@/app/bench/icons";
import { useOffline } from "@/app/bench/providers";
import { Sheet } from "@/app/bench/sheet";
import { SaveToast } from "@/app/bench/toast";
import { usePendingPhrase } from "@/app/bench/use-pending-phrase";
import { idleForm } from "@/lib/bench/form-state";
import { JOB_STATUSES, STATUS_LABELS, type JobStatus } from "@/lib/jobs/domain";

export function WhereAt({
  jobRef,
  status,
  nextMove,
  latestKind,
  latestText,
  latestTime,
  latestNoteId,
}: {
  jobRef: string;
  status: JobStatus;
  nextMove: string;
  latestKind: "finding" | "note" | "empty";
  latestText: string;
  latestTime: string | null;
  latestNoteId: string | null;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const statusButton = useRef<HTMLButtonElement>(null);
  const moveButton = useRef<HTMLButtonElement>(null);
  const moveInput = useRef<HTMLInputElement>(null);
  const currentStatus = useRef<HTMLButtonElement>(null);

  const closeStatus = useCallback(() => setStatusOpen(false), []);
  const closeMove = useCallback(() => setMoveOpen(false), []);
  const findingLabel = latestKind === "note" ? "Latest note" : "Latest finding";

  function scrollToNote() {
    if (!latestNoteId) return;
    document.getElementById(`note-${latestNoteId}`)?.scrollIntoView({ block: "nearest" });
  }

  return (
    <section className="where-card" aria-label="Where I'm at">
      <button ref={statusButton} type="button" className="where-row" onClick={() => setStatusOpen(true)}>
        <span className={`status-pill status-${status}`}>{STATUS_LABELS[status]}</span>
        <span className="where-kicker">Status ›</span>
      </button>
      <button ref={moveButton} type="button" className="where-row" onClick={() => setMoveOpen(true)}>
        <span className="where-row-text">
          <span className="where-kicker">Next move</span>
          <span className="where-value clamp-3">{nextMove}</span>
        </span>
        <ChevronIcon direction="right" />
      </button>
      {latestNoteId ? (
        <button type="button" className="where-row" onClick={scrollToNote}>
          <FindingCopy label={findingLabel} time={latestTime} text={latestText} />
        </button>
      ) : (
        <div className="where-row">
          <FindingCopy label={findingLabel} time={null} text={latestText} />
        </div>
      )}
      <StatusSheet
        open={statusOpen}
        jobRef={jobRef}
        status={status}
        currentRef={currentStatus}
        restoreRef={statusButton}
        onClose={closeStatus}
      />
      <NextMoveSheet
        open={moveOpen}
        jobRef={jobRef}
        nextMove={nextMove}
        inputRef={moveInput}
        restoreRef={moveButton}
        onClose={closeMove}
      />
    </section>
  );
}

function FindingCopy({ label, time, text }: { label: string; time: string | null; text: string }) {
  return (
    <span className="where-row-text">
      <span className="where-meta">
        <span className="where-kicker">{label}</span>
        {time ? <span className="where-kicker">{time}</span> : null}
      </span>
      <span className="where-finding clamp-2">{text}</span>
    </span>
  );
}

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

function NextMoveSheet({
  open,
  jobRef,
  nextMove,
  inputRef,
  restoreRef,
  onClose,
}: {
  open: boolean;
  jobRef: string;
  nextMove: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  restoreRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const offline = useOffline();
  const [state, action, pending] = useActionState(saveNextMoveAction, idleForm);
  const phrase = usePendingPhrase(pending, "Saving…", "Save");
  const seen = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!state.noticeId || state.noticeId === seen.current) return;
    seen.current = state.noticeId;
    onClose();
  }, [state.noticeId, onClose]);

  return (
    <>
      <Sheet open={open} title="Next move" onClose={onClose} initialFocusRef={inputRef} restoreFocusRef={restoreRef}>
        <form action={action} className="sheet-form">
          <input type="hidden" name="ref" value={jobRef} />
          <label className="field">
            <span className="field-label">Next move</span>
            <input
              ref={inputRef}
              name="next_move"
              required
              maxLength={180}
              defaultValue={nextMove}
              autoComplete="off"
              readOnly={pending}
            />
          </label>
          {state.error ? <ErrorPanel message={state.error} reason={state.reason} /> : null}
        <button className="tech-btn-primary" type="submit" disabled={pending || offline}>
          {phrase}
        </button>
      </form>
      </Sheet>
      <SaveToast message={state.notice} token={state.noticeId} />
    </>
  );
}
