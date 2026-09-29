"use client";

import { useEffect } from "react";
import { shouldPreventDocumentMove } from "@/lib/bench/scroll-lock";

const SCROLLABLE = ".app-scroll, .chat-log, .sheet, .pin-form-body";
const EDITABLE = "input, textarea, select, [contenteditable='true']";

function editableTarget(target: Element): boolean {
  return target.closest(EDITABLE) instanceof Element;
}

/** The scrollport the gesture started in. A sheet backdrop is chrome, not a scroller. */
function scrollableTarget(target: Element, frame: HTMLElement): HTMLElement | null {
  if (target.closest(".sheet-layer") && !target.closest(".sheet")) return null;
  const match = target.closest(SCROLLABLE);
  if (!(match instanceof HTMLElement) || !frame.contains(match)) return null;
  return match;
}

/** Pins the frame to the visual viewport and cancels document rubber-band on the frame. */
export function AppScrollLock() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const syncViewport = () => {
      const height = viewport?.height ?? window.innerHeight;
      const offset = viewport?.offsetTop ?? 0;
      const root = document.documentElement;
      root.style.setProperty("--vvh", `${Math.round(height)}px`);
      root.style.setProperty("--vv-top", `${Math.round(offset)}px`);
    };
    syncViewport();
    viewport?.addEventListener("resize", syncViewport);
    viewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);

    let frame: HTMLElement | null = null;
    let startY = 0;
    let startTarget: EventTarget | null = null;

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      startY = touch.clientY;
      startTarget = event.target;
    };

    const onMove = (event: TouchEvent) => {
      if (!frame) return;
      const touch = event.touches[0];
      if (!touch || !(startTarget instanceof Element) || !frame.contains(startTarget)) return;
      const scrollable = scrollableTarget(startTarget, frame);
      const relaxed =
        document.documentElement.dataset.kb === "1" || window.matchMedia("(max-height: 480px)").matches;
      const prevent = shouldPreventDocumentMove({
        pinch: event.touches.length > 1,
        relaxed,
        editable: editableTarget(startTarget),
        inScrollable: scrollable !== null,
        scrollTop: scrollable?.scrollTop ?? 0,
        scrollHeight: scrollable?.scrollHeight ?? 0,
        clientHeight: scrollable?.clientHeight ?? 0,
        deltaY: touch.clientY - startY,
      });
      if (prevent && event.cancelable) event.preventDefault();
    };

    const bind = (next: HTMLElement | null) => {
      if (frame === next) return;
      if (frame) {
        frame.removeEventListener("touchstart", onStart);
        frame.removeEventListener("touchmove", onMove);
      }
      frame = next;
      if (!frame) return;
      frame.addEventListener("touchstart", onStart, { passive: true });
      frame.addEventListener("touchmove", onMove, { passive: false });
    };

    const syncFrame = () => {
      const found = document.querySelector(".app-frame");
      bind(found instanceof HTMLElement ? found : null);
    };

    syncFrame();
    const observer = new MutationObserver(syncFrame);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      bind(null);
      viewport?.removeEventListener("resize", syncViewport);
      viewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
    };
  }, []);
  return null;
}
