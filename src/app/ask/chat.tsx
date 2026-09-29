"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { saveAssistantNoteAction } from "@/app/ask/actions";
import { ErrorPanel } from "@/app/bench/error-panel";
import { SendIcon } from "@/app/bench/icons";
import { useOffline } from "@/app/bench/providers";
import { Sheet, type SheetHandle } from "@/app/bench/sheet";
import { usePendingPhrase } from "@/app/bench/use-pending-phrase";
import { NOT_CONFIGURED_MESSAGE, suggestionDraft, suggestionsFor } from "@/lib/assistant/copy";
import { HISTORY_MESSAGE_LIMIT } from "@/lib/assistant/limit";
import { ReplyBlocks } from "@/app/bench/note-blocks";
import { SaveHeadline } from "@/app/bench/save-headline";
import { defaultSaveTag } from "@/lib/assistant/save-note";
import { SAVE_TAG_OPTIONS } from "@/lib/bench/note-tag-options";
import { idleForm, type FormState } from "@/lib/bench/form-state";

type StoredMessage = {
  role: "user" | "assistant";
  text: string;
  reason?: string;
};

type SaveDraft = { text: string; tag: string };

const STORED_LIMIT = 40;

const EMPTY_THREAD: StoredMessage[] = [];
const THREAD_EVENT = "ll-ask";

function storageKey(scopeRef: string | null): string {
  return scopeRef ? `ll-ask:${scopeRef}` : "ll-ask";
}

function writeThread(key: string, messages: StoredMessage[]) {
  sessionStorage.setItem(key, JSON.stringify(messages));
  window.dispatchEvent(new Event(THREAD_EVENT));
}

function useThread(key: string): StoredMessage[] {
  const snapshot = useRef<{ key: string; raw: string; messages: StoredMessage[] }>({
    key: "",
    raw: "",
    messages: EMPTY_THREAD,
  });
  return useSyncExternalStore(
    (onChange) => {
      const handler = () => onChange();
      window.addEventListener(THREAD_EVENT, handler);
      return () => window.removeEventListener(THREAD_EVENT, handler);
    },
    () => {
      const raw = sessionStorage.getItem(key) ?? "";
      if (snapshot.current.key === key && snapshot.current.raw === raw) return snapshot.current.messages;
      const messages = readStored(raw);
      snapshot.current = { key, raw, messages };
      return messages;
    },
    () => EMPTY_THREAD,
  );
}

function ReplyBody({ text }: { text: string }) {
  return <ReplyBlocks text={text} />;
}

function readStored(raw: string | null): StoredMessage[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const messages: StoredMessage[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      if (record.role !== "user" && record.role !== "assistant") continue;
      if (typeof record.text !== "string" || !record.text.trim()) continue;
      const message: StoredMessage = { role: record.role, text: record.text };
      if (typeof record.reason === "string" && record.reason.trim()) message.reason = record.reason;
      messages.push(message);
    }
    return messages.slice(-STORED_LIMIT);
  } catch {
    return [];
  }
}

export function AskClear({ scopeRef }: { scopeRef: string | null }) {
  return (
    <button
      className="bar-text-btn"
      type="button"
      onClick={() => {
        sessionStorage.removeItem(storageKey(scopeRef));
        window.dispatchEvent(new Event(THREAD_EVENT));
      }}
    >
      Clear
    </button>
  );
}

export function AskChat({ configured, scopeRef }: { configured: boolean; scopeRef: string | null }) {
  const key = storageKey(scopeRef);
  const messages = useThread(key);
  const offline = useOffline();
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [sheet, setSheet] = useState<SaveDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<FormState>(idleForm);
  const [toast, setToast] = useState<string | null>(null);
  const savePhrase = usePendingPhrase(saving, "Saving…", "Save");
  const endRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const sheetRef = useRef<SheetHandle>(null);
  const restoreRef = useRef<HTMLButtonElement>(null);
  const originRef = useRef<string | null>(null);
  const saveDrafts = useRef(new Map<string, SaveDraft>());

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  useEffect(() => {
    const node = draftRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, [draft]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function sendText(text: string) {
    const line = text.trim();
    if (!line || pending || !configured) return;
    const next = [...messages, { role: "user" as const, text: line }].slice(-STORED_LIMIT);
    writeThread(key, next);
    setDraft("");
    setPending(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(-HISTORY_MESSAGE_LIMIT).map(({ role, text: body }) => ({ role, text: body })),
          scopeRef,
        }),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        reply?: string;
        message?: string;
        reasons?: string[];
      };
      const reply = body.ok ? (body.reply ?? "Done.") : (body.message ?? "That failed.");
      const reason = body.ok && body.reasons && body.reasons.length > 0 ? body.reasons.join("\n") : undefined;
      const replyMessage: StoredMessage = { role: "assistant", text: reply, ...(reason ? { reason } : {}) };
      writeThread(key, [...next, replyMessage].slice(-STORED_LIMIT));
    } catch {
      const replyMessage: StoredMessage = { role: "assistant", text: "That failed." };
      writeThread(key, [...next, replyMessage].slice(-STORED_LIMIT));
    } finally {
      setPending(false);
    }
  }

  function send(event: React.FormEvent) {
    event.preventDefault();
    void sendText(draft);
  }

  function pickSuggestion(prompt: string) {
    const next = suggestionDraft(prompt);
    if (!next.send) {
      setDraft(next.text);
      draftRef.current?.focus();
      return;
    }
    void sendText(next.text);
  }

  function openSave(text: string) {
    setSaveError(idleForm);
    originRef.current = text;
    const kept = saveDrafts.current.get(text);
    sheetRef.current?.prepare();
    setSheet(kept ?? { text, tag: defaultSaveTag() });
    noteRef.current?.focus();
  }

  function keepAndClose() {
    if (saving) return;
    if (sheet && originRef.current) saveDrafts.current.set(originRef.current, sheet);
    setSheet(null);
  }

  async function confirmSave() {
    if (!sheet || !scopeRef || saving) return;
    const text = sheet.text.trim();
    if (!text) {
      setSaveError({ error: "Note is required.", reason: null });
      return;
    }
    setSaving(true);
    setSaveError(idleForm);
    try {
      const result = await saveAssistantNoteAction({ ref: scopeRef, text, tag: sheet.tag });
      if (result.error) {
        setSaveError(result);
        return;
      }
      if (originRef.current) saveDrafts.current.delete(originRef.current);
      originRef.current = null;
      setSheet(null);
      setToast("Saved to notes.");
    } catch {
      setSaveError({ error: "Could not file the note.", reason: null });
    } finally {
      setSaving(false);
    }
  }

  if (!configured) {
    return <p className="empty">{NOT_CONFIGURED_MESSAGE}</p>;
  }

  const suggestions = messages.length === 0 && !pending ? suggestionsFor(scopeRef) : [];

  return (
    <div className="chat">
      <div className="chat-log" aria-live="polite">
        {suggestions.length > 0 ? (
          <div className="suggest-list">
            <p className="prompt-line">{scopeRef ? "What do you want to check?" : "Ask about the jobs on the bench."}</p>
            {suggestions.map((prompt) => (
              <button key={prompt} className="suggest-btn" type="button" onClick={() => pickSuggestion(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
        ) : null}
        <ul className="chat-list">
          {messages.map((message, index) => (
            <li key={`${message.role}-${index}`} className={message.role === "user" ? "bubble bubble-user" : "reply-block"}>
              {message.role === "assistant" ? <ReplyBody text={message.text} /> : <p>{message.text}</p>}
              {message.reason ? <p className="bubble-reason">{message.reason}</p> : null}
              {message.role === "assistant" && scopeRef ? (
                <button
                  className="tech-btn-quiet save-note-btn"
                  type="button"
                  onClick={(event) => {
                    restoreRef.current = event.currentTarget;
                    openSave(message.text);
                  }}
                >
                  Save to notes
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {pending ? (
          <p className="thinking" role="status">
            Thinking…
          </p>
        ) : null}
        <div ref={endRef} />
      </div>
      {toast ? (
        <p className="toast" role="status">
          {toast}
        </p>
      ) : null}
      <form onSubmit={send} className="composer">
        <label className="sr-only" htmlFor="ask-text">
          Message
        </label>
        <textarea
          id="ask-text"
          ref={draftRef}
          className="ask-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={scopeRef ? "Ask about this fault" : "Ask the record"}
          rows={1}
          maxLength={4000}
          enterKeyHint="send"
          readOnly={pending}
        />
        <button className="send-btn" type="submit" aria-label="Send" disabled={pending || !draft.trim()}>
          <SendIcon />
        </button>
      </form>
      <Sheet
        ref={sheetRef}
        open={sheet !== null}
        title="Save to notes"
        showClose={false}
        onClose={keepAndClose}
        initialFocusRef={noteRef}
        restoreFocusRef={restoreRef}
      >
        <div className="sheet-form">
          <p className="muted sheet-lead">Nothing is filed until you tap Save.</p>
          <label className="field">
            <span className="field-label">Note</span>
            <textarea
              ref={noteRef}
              className="save-text-input"
              value={sheet?.text ?? ""}
              onChange={(event) => setSheet((current) => (current ? { ...current, text: event.target.value } : current))}
              rows={6}
              maxLength={4000}
              readOnly={saving}
            />
          </label>
          <SaveHeadline text={sheet?.text ?? ""} />
          <label className="field">
            <span className="field-label">Tag</span>
            <select
              className="select-control"
              value={sheet?.tag ?? defaultSaveTag()}
              aria-disabled={saving || undefined}
              onChange={(event) => {
                if (saving) return;
                const tag = event.target.value;
                setSheet((current) => (current ? { ...current, tag } : current));
              }}
            >
              {SAVE_TAG_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {saveError.error ? <ErrorPanel message={saveError.error} reason={saveError.reason} /> : null}
          <div className="sheet-actions">
            <button className="tech-btn-secondary" type="button" disabled={saving} onClick={keepAndClose}>
              Cancel
            </button>
            <button className="tech-btn-primary" type="button" disabled={saving || offline} onClick={() => void confirmSave()}>
              {savePhrase}
            </button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
