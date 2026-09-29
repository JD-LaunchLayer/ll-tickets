"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AskIcon, ListIcon, PlusIcon } from "@/app/bench/icons";
import { tabCurrent, type BenchTab } from "@/lib/bench/tabs";

const TABS: Array<{ href: string; label: string; id: BenchTab; icon: React.ReactNode }> = [
  { href: "/", label: "Jobs", id: "jobs", icon: <ListIcon /> },
  { href: "/jobs/new", label: "New job", id: "new", icon: <PlusIcon /> },
  { href: "/ask", label: "Ask", id: "ask", icon: <AskIcon /> },
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
            {tab.icon}
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
