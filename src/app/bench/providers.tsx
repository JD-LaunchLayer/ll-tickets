"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppScrollLock } from "@/app/bench/scroll-lock";

type BenchUi = {
  offline: boolean;
  sheetOpen: boolean;
  pushSheet: () => void;
  popSheet: () => void;
};

const BenchUiContext = createContext<BenchUi | null>(null);

export function useBenchUi(): BenchUi {
  const value = useContext(BenchUiContext);
  if (value) return value;
  return {
    offline: false,
    sheetOpen: false,
    pushSheet: () => {},
    popSheet: () => {},
  };
}

export function useOffline(): boolean {
  return useBenchUi().offline;
}

function useOfflineFlag(): boolean {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(navigator.onLine === false);
    sync();
    window.addEventListener("offline", sync);
    window.addEventListener("online", sync);
    return () => {
      window.removeEventListener("offline", sync);
      window.removeEventListener("online", sync);
    };
  }, []);
  return offline;
}

export function KeyboardInset() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty("--kb", `${Math.round(inset)}px`);
      document.documentElement.dataset.kb = inset > 80 ? "1" : "0";
    };
    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    window.addEventListener("resize", sync);
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);
  return null;
}

export function BenchProviders({ children }: { children: React.ReactNode }) {
  const offline = useOfflineFlag();
  const [sheets, setSheets] = useState(0);
  const pushSheet = useCallback(() => setSheets((count) => count + 1), []);
  const popSheet = useCallback(() => setSheets((count) => Math.max(0, count - 1)), []);
  const value = useMemo(
    () => ({ offline, sheetOpen: sheets > 0, pushSheet, popSheet }),
    [offline, sheets, pushSheet, popSheet],
  );
  return (
    <BenchUiContext.Provider value={value}>
      <KeyboardInset />
      <AppScrollLock />
      {children}
    </BenchUiContext.Provider>
  );
}

export function BenchFrame({ children }: { children: React.ReactNode }) {
  const { sheetOpen } = useBenchUi();
  return (
    <div className="app-frame" data-sheet-open={sheetOpen ? "true" : undefined}>
      {children}
    </div>
  );
}

export function OfflineBanner() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <p className="offline-banner" role="status">
      You&apos;re offline. Notes can&apos;t be filed yet.
    </p>
  );
}
