"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ChevronIcon } from "@/app/bench/icons";

const RETURN_FLAG = "ll-return-via-back";

/** Remember history length when a job is opened from the list, so Back can restore that scroll. */
export function markListReturn() {
  sessionStorage.setItem(RETURN_FLAG, String(window.history.length));
}

export function RememberListLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => markListReturn()}>
      {children}
    </Link>
  );
}

/** Restores the list scroller after Back, and drops a stale return flag once the list is showing. */
export function ListScrollMemory() {
  useEffect(() => {
    sessionStorage.removeItem(RETURN_FLAG);
    const scroller = document.querySelector(".app-scroll");
    if (!(scroller instanceof HTMLElement)) return;
    const saved = sessionStorage.getItem("ll-list-scroll");
    const frame = window.requestAnimationFrame(() => {
      if (saved) scroller.scrollTop = Number(saved);
    });
    const onScroll = () => sessionStorage.setItem("ll-list-scroll", String(scroller.scrollTop));
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", onScroll);
    };
  }, []);
  return null;
}

export function BackToJobs({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="icon-btn icon-btn-plain"
      aria-label="Back to jobs"
      onClick={(event) => {
        const marked = Number(sessionStorage.getItem(RETURN_FLAG));
        if (Number.isFinite(marked) && window.history.length === marked + 1) {
          event.preventDefault();
          window.history.back();
        }
      }}
    >
      <ChevronIcon direction="left" />
    </Link>
  );
}
