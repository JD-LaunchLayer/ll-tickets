"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tabCurrent, type BenchTab } from "@/lib/bench/tabs";

const TABS: Array<{ href: string; label: string; id: BenchTab }> = [
  { href: "/", label: "Jobs", id: "jobs" },
  { href: "/jobs/new", label: "New job", id: "new" },
  { href: "/ask", label: "Ask", id: "ask" },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="tab-bar" aria-label="Bench">
      {TABS.map((tab) => {
        const current = tabCurrent(pathname, tab.id);
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className="tab-link"
            aria-current={current ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
