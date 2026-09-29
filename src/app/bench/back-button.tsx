"use client";

import Link from "next/link";
import { ChevronIcon } from "@/app/bench/icons";

const RETURN_FLAG = "ll-return-via-back";

/** Remember history length when a job is opened from the list, so Back can restore that scroll. */
export function markListReturn() {
  sessionStorage.setItem(RETURN_FLAG, String(window.history.length));
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
