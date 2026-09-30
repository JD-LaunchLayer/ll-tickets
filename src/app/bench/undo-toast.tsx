"use client";

import { useEffect, useRef, useState } from "react";

const TOAST_MS = 6000;

export function UndoToast({
  message,
  token,
  onUndo,
}: {
  message: string | null;
  token: number | null;
  onUndo: () => void;
}) {
  const [hiddenToken, setHiddenToken] = useState<number | null>(null);
  const hideAt = useRef(0);
  const timer = useRef(0);
  const paused = useRef(false);
  const remaining = useRef(TOAST_MS);
  const visible = Boolean(message) && token != null && token !== hiddenToken;

  useEffect(() => {
    if (!message || token == null) return;
    hideAt.current = Date.now() + TOAST_MS;
    remaining.current = TOAST_MS;
    paused.current = false;
    const timerId = window.setTimeout(() => setHiddenToken(token), TOAST_MS);
    timer.current = timerId;
    return () => window.clearTimeout(timerId);
  }, [message, token]);

  function pause() {
    if (!visible || paused.current) return;
    paused.current = true;
    remaining.current = Math.max(0, hideAt.current - Date.now());
    window.clearTimeout(timer.current);
  }

  function resume() {
    if (!paused.current || token == null) return;
    paused.current = false;
    hideAt.current = Date.now() + remaining.current;
    timer.current = window.setTimeout(() => setHiddenToken(token), remaining.current);
  }

  if (!visible || !message) return null;
  return (
    <div
      className="toast undo-toast"
      role="status"
      aria-live="polite"
      onPointerDown={pause}
      onPointerUp={resume}
      onPointerCancel={resume}
      onPointerLeave={resume}
    >
      <p className="undo-message">{message}</p>
      <button type="button" className="undo-action" onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}
