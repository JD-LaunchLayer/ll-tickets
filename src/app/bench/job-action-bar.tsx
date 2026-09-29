"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { fileNoteAction } from "@/app/bench/actions";
import { ErrorPanel } from "@/app/bench/error-panel";
import { ChevronIcon } from "@/app/bench/icons";
import { useOffline } from "@/app/bench/providers";
import { Sheet, type SheetHandle } from "@/app/bench/sheet";
import { SaveToast } from "@/app/bench/toast";
import { usePendingPhrase } from "@/app/bench/use-pending-phrase";
import { draftKey, draftLauncherLabel, emptyDraft, parseDraft, type NoteDraft } from "@/lib/bench/draft";
import { idleForm } from "@/lib/bench/form-state";
import { DEFAULT_NOTE_TAG, NOTE_TAG_OPTIONS } from "@/lib/bench/note-tag-options";

export function JobActionBar({
  jobRef,
  nextMove,
  previousHref,
  nextHref,
}: {
  jobRef: string;
  nextMove: string;
  previousHref: string | null;
  nextHref: string | null;
}) {
  const router = useRouter();
  const offline = useOffline();
  const key = draftKey(jobRef);
  const draft = useNoteDraft(key);
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const sheetRef = useRef<SheetHandle>(null);
  const [state, action, pending] = useActionState(fileNoteAction, idleForm);
  const phrase = usePendingPhrase(pending, "Filing…", "File note");
  const [seenNotice, setSeenNotice] = useState<string | undefined>(undefined);
  if (state.noticeId && state.noticeId !== seenNotice) {
    setSeenNotice(state.noticeId);
    setMoveOpen(false);
    setOpen(false);
  }

  useEffect(() => {
    if (!seenNotice) return;
    sessionStorage.removeItem(key);
    window.dispatchEvent(new Event("ll-draft"));
    sessionStorage.setItem("ll-fresh", jobRef);
    window.dispatchEvent(new Event("ll-note-filed"));
  }, [seenNotice, key, jobRef]);

  function writeDraft(next: NoteDraft) {
    if (!next.text && next.tag === DEFAULT_NOTE_TAG) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(next));
    window.dispatchEvent(new Event("ll-draft"));
  }

  function grow(node: HTMLTextAreaElement) {
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }

  function openSheet() {
    sheetRef.current?.prepare();
    setOpen(true);
    const field = textRef.current;
    if (!field) return;
    field.focus();
    grow(field);
  }

  const text = draft.text;
  const tag = draft.tag;
  const launcher = draftLauncherLabel(text);

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        className={text.trim() ? "note-launcher has-draft" : "note-launcher"}
        onClick={openSheet}
      >
        {launcher}
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label="Previous job"
        disabled={!previousHref}
        onClick={() => {
          if (previousHref) router.replace(previousHref);
        }}
      >
        <ChevronIcon direction="up" />
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label="Next job"
        disabled={!nextHref}
        onClick={() => {
          if (nextHref) router.replace(nextHref);
        }}
      >
        <ChevronIcon direction="down" />
      </button>
      <Sheet
        ref={sheetRef}
        open={open}
        title={`New note · ${jobRef}`}
        onClose={() => setOpen(false)}
        initialFocusRef={textRef}
        restoreFocusRef={launcherRef}
      >
        <form
          action={action}
          className="sheet-form"
          onSubmit={(event) => {
            if (!draft.text.trim()) event.preventDefault();
          }}
        >
          <input type="hidden" name="ref" value={jobRef} />
          <label className="field">
            <span className="field-label">Note</span>
            <textarea
              ref={textRef}
              className="note-text-input"
              name="text"
              required
              maxLength={4000}
              rows={4}
              placeholder="What did you find?"
              value={text}
              readOnly={pending}
              onChange={(event) => {
                writeDraft({ text: event.target.value, tag });
                grow(event.target);
              }}
            />
          </label>
          <label className="field">
            <span className="field-label">Tag</span>
            <select
              className="select-control"
              name="tag"
              value={tag}
              aria-disabled={pending || undefined}
              onChange={(event) => {
                if (!pending) writeDraft({ text, tag: event.target.value });
              }}
            >
              {NOTE_TAG_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {moveOpen ? (
            <label className="field">
              <span className="field-label">Next move</span>
              <input name="next_move" maxLength={180} defaultValue={nextMove} autoComplete="off" readOnly={pending} />
            </label>
          ) : (
            <div className="next-move-line">
              <p>
                <span className="where-kicker">Next move: </span>
                {nextMove}
              </p>
              <button type="button" className="tech-btn-quiet change-btn" onClick={() => setMoveOpen(true)}>
                Change
              </button>
            </div>
          )}
          <div className="sheet-submit">
            {state.error ? <ErrorPanel message={state.error} reason={state.reason} /> : null}
            <button className="tech-btn-primary" type="submit" disabled={pending || offline || !text.trim()}>
              {phrase}
            </button>
          </div>
        </form>
      </Sheet>
      <SaveToast message={state.notice} token={state.noticeId} />
    </>
  );
}

function subscribeDraft(onChange: () => void) {
  window.addEventListener("ll-draft", onChange);
  return () => window.removeEventListener("ll-draft", onChange);
}

function useNoteDraft(key: string): NoteDraft {
  const raw = useSyncExternalStore(
    subscribeDraft,
    () => sessionStorage.getItem(key) ?? "",
    () => "",
  );
  if (!raw) return emptyDraft();
  return parseDraft(raw);
}
