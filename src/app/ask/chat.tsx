"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { NOT_CONFIGURED_MESSAGE } from "@/lib/assistant/copy";
import { HISTORY_MESSAGE_LIMIT } from "@/lib/assistant/limit";

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
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, pending]);

  function clear() {
    sessionStorage.removeItem(key);
    window.dispatchEvent(new Event(THREAD_EVENT));
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || pending || !configured) return;
    const next = [...messages, { role: "user" as const, text }].slice(-STORED_LIMIT);
    writeThread(key, next);
    setDraft("");
    setPending(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(-HISTORY_MESSAGE_LIMIT).map(({ role, text: line }) => ({ role, text: line })),
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

  if (!configured) {
    return <p className="text-lg">{NOT_CONFIGURED_MESSAGE}</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2">
        {detail ? <p className="text-sm text-slate-700">{detail}</p> : <span />}
        <button className="tech-btn-quiet" type="button" onClick={clear}>
          Clear
        </button>
      </div>
      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto" aria-live="polite">
        {messages.length === 0 && !pending ? <p className="text-lg text-slate-600">Talk. I&apos;ll file it.</p> : null}
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
            </li>
          ))}
        </ul>
        {pending ? <p className="text-lg text-slate-600">One moment.</p> : null}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="mt-3 flex flex-col gap-2">
        <label className="field-label" htmlFor="ask-text">
          Message
        </label>
        <textarea
          id="ask-text"
          className="ask-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Say what to file"
          rows={3}
          enterKeyHint="enter"
          disabled={pending}
        />
        <button className="tech-btn-primary" type="submit" disabled={pending || !draft.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
