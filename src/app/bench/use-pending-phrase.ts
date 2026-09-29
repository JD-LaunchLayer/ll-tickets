"use client";

import { useEffect, useState } from "react";
import { pendingPhrase } from "@/lib/bench/pending-phrase";

/** Idle label, then the pending label, then "… still working" after one second. */
export function usePendingPhrase(pending: boolean, active: string, idle: string): string {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setSlow(true), 1000);
    return () => {
      window.clearTimeout(timer);
      setSlow(false);
    };
  }, [pending]);
  return pendingPhrase(pending, pending && slow, active, idle);
}
