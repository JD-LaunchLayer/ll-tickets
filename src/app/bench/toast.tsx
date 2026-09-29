"use client";

import { useEffect, useState } from "react";

export function SaveToast({
  message,
  token,
}: {
  message: string | null | undefined;
  token?: string;
}) {
  const [hiddenToken, setHiddenToken] = useState<string | undefined>(undefined);
  const visible = Boolean(message) && token !== hiddenToken;

  useEffect(() => {
    if (!message || !token) return;
    const timer = window.setTimeout(() => setHiddenToken(token), 2500);
    return () => window.clearTimeout(timer);
  }, [message, token]);

  if (!visible || !message) return null;
  return (
    <p className="toast" role="status">
      {message}
    </p>
  );
}
