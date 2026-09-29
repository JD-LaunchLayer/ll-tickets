"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { saveAssistantNoteAction } from "@/app/ask/actions";
import { ErrorPanel } from "@/app/bench/error-panel";
import { NOT_CONFIGURED_MESSAGE, suggestionDraft, suggestionsFor } from "@/lib/assistant/copy";
import { HISTORY_MESSAGE_LIMIT } from "@/lib/assistant/limit";
import { splitReply } from "@/lib/assistant/reply";
import { defaultSaveTag } from "@/lib/assistant/save-note";
import { idleForm, type FormState } from "@/lib/bench/form-state";
import { NOTE_TAGS, NOTE_TAG_LABELS, type NoteTag } from "@/lib/jobs/domain";

type StoredMessage = {
  role: "user" | "assistant";
  text: string;
  reason?: string;
};

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
  const blocks = splitReply(text);
  if (blocks.length === 0) return null;
  return (
    <div className="reply">
      {blocks.map((block, index) => {
        if (block.type === "ul") {
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ol>
          );
        }
        return <p key={index}>{block.text}</p>;
      })}
    </div>
  );
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

export function AskChat({
  configured,
  scopeRef,
  detail,
}: {
  configured: boolean;
  scopeRef: string | null;
  detail?: string;
}) {
  const key = storageKey(scopeRef);
  const messages = useThread(key);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [sheet, setSheet] = useState<{ text: string; tag: NoteTag } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<FormState>(idleForm);
  const [toast, setToast] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function clear() {
    sessionStorage.removeItem(key);
    window.dispatchEvent(new Event(THREAD_EVENT));
  }

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
    setSheet({ text, tag: defaultSaveTag() });
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
      <div className="job-card-top">
        {detail ? <p className="muted">{detail}</p> : <span />}
        <button className="tech-btn-quiet" type="button" onClick={clear}>
          Clear
        </button>
      </div>
      <div className="chat-log" aria-live="polite">
        {suggestions.length > 0 ? (
          <div className="job-list">
            <p className="muted">{scopeRef ? "What do you want to check?" : "Ask about the jobs on the bench."}</p>
            <div className="chip-row">
              {suggestions.map((prompt) => (
                <button key={prompt} className="chip" type="button" onClick={() => pickSuggestion(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <ul className="chat-list">
          {messages.map((message, index) => (
            <li key={`${message.role}-${index}`} className={message.role === "user" ? "bubble bubble-user" : "bubble bubble-assistant"}>
              {message.role === "assistant" ? <ReplyBody text={message.text} /> : <p>{message.text}</p>}
              {message.reason ? <p className="bubble-reason">{message.reason}</p> : null}
              {message.role === "assistant" && scopeRef ? (
                <button className="tech-btn-quiet" type="button" onClick={() => openSave(message.text)}>
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
        <label className="field-label" htmlFor="ask-text">
          Message
        </label>
        <textarea
          id="ask-text"
          ref={draftRef}
          className="ask-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={scopeRef ? "Ask about this fault" : "Ask the record"}
          rows={3}
          enterKeyHint="send"
          disabled={pending}
        />
        <button className="tech-btn-primary" type="submit" disabled={pending || !draft.trim()}>
          Send
        </button>
      </form>
      {sheet && scopeRef ? (
        <div className="sheet-backdrop">
          <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="save-note-title">
            <h2 id="save-note-title" className="page-title">
              Save to notes
            </h2>
            <p className="muted">Nothing is filed until you tap Save.</p>
            <label className="field">
              <span className="field-label">Note</span>
              <textarea
                value={sheet.text}
                onChange={(event) => setSheet({ ...sheet, text: event.target.value })}
                rows={6}
                maxLength={4000}
              />
            </label>
            <fieldset>
              <legend className="field-label">Tag</legend>
              <div className="chip-row">
                {NOTE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="chip"
                    aria-pressed={tag === sheet.tag}
                    onClick={() => setSheet({ ...sheet, tag })}
                  >
                    {NOTE_TAG_LABELS[tag]}
                  </button>
                ))}
              </div>
            </fieldset>
            {saveError.error ? <ErrorPanel message={saveError.error} reason={saveError.reason} /> : null}
            <div className="sheet-actions">
              <button
                className="tech-btn-secondary"
                type="button"
                disabled={saving}
                onClick={() => {
                  setSheet(null);
                  setSaveError(idleForm);
                }}
              >
                Cancel
              </button>
              <button className="tech-btn-primary" type="button" disabled={saving} onClick={() => void confirmSave()}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
