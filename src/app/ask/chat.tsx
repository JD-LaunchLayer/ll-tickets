"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { saveAssistantNoteAction } from "@/app/ask/actions";
import { NOT_CONFIGURED_MESSAGE, suggestionDraft, suggestionsFor } from "@/lib/assistant/copy";
import { HISTORY_MESSAGE_LIMIT } from "@/lib/assistant/limit";
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
    return <p className="text-lg">{NOT_CONFIGURED_MESSAGE}</p>;
  }

  const suggestions = messages.length === 0 && !pending ? suggestionsFor(scopeRef) : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2">
        {detail ? <p className="text-sm text-slate-700">{detail}</p> : <span />}
        <button className="tech-btn-quiet" type="button" onClick={clear}>
          Clear
        </button>
      </div>
      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto" aria-live="polite">
        {suggestions.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-lg text-slate-600">
              {scopeRef ? "What do you want to check?" : "Ask about the jobs on the bench."}
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((prompt) => (
                <button key={prompt} className="tech-btn-secondary w-auto" type="button" onClick={() => pickSuggestion(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <ul className="flex flex-col gap-2">
          {messages.map((message, index) => (
            <li
              key={`${message.role}-${index}`}
              className={
                message.role === "user"
                  ? "ml-8 rounded-lg bg-[#3b82f6] px-3 py-2 text-lg text-white"
                  : "mr-8 rounded-lg bg-white px-3 py-2 text-lg text-slate-900"
              }
            >
              <p className="whitespace-pre-wrap">{message.text}</p>
              {message.reason ? <p className="mt-1 text-sm text-red-800">{message.reason}</p> : null}
              {message.role === "assistant" && scopeRef ? (
                <button className="tech-btn-quiet mt-1 px-0" type="button" onClick={() => openSave(message.text)}>
                  Save to notes
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {pending ? <p className="text-lg text-slate-600">Thinking…</p> : null}
        <div ref={endRef} />
      </div>
      {toast ? (
        <p className="mt-2 text-sm font-semibold text-slate-800" role="status">
          {toast}
        </p>
      ) : null}
      <form onSubmit={send} className="mt-3 flex flex-col gap-2">
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
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-slate-900/40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div
            className="w-full max-w-lg rounded-t-xl bg-white p-4 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-note-title"
          >
            <h2 id="save-note-title" className="text-lg font-semibold">
              Save to notes
            </h2>
            <p className="mt-1 text-sm text-slate-600">Nothing is filed until you tap Save.</p>
            <label className="field mt-3">
              <span className="field-label">Note</span>
              <textarea
                value={sheet.text}
                onChange={(event) => setSheet({ ...sheet, text: event.target.value })}
                rows={6}
                maxLength={4000}
              />
            </label>
            <fieldset className="mt-3">
              <legend className="field-label">Tag</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {NOTE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={tag === sheet.tag ? "tech-btn-primary w-auto" : "tech-btn-secondary w-auto"}
                    aria-pressed={tag === sheet.tag}
                    onClick={() => setSheet({ ...sheet, tag })}
                  >
                    {NOTE_TAG_LABELS[tag]}
                  </button>
                ))}
              </div>
            </fieldset>
            {saveError.error ? (
              <div className="mt-3" role="alert">
                <p className="text-sm text-red-700">{saveError.error}</p>
                {saveError.reason ? <p className="mt-1 text-sm text-red-700">{saveError.reason}</p> : null}
              </div>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
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
