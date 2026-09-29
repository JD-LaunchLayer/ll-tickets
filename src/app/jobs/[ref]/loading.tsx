import Link from "next/link";
import { ChevronIcon } from "@/app/bench/icons";
import { TabBar } from "@/app/bench/tab-bar";

export default function JobLoading() {
  return (
    <div className="app-frame" aria-busy="true">
      <header className="top-bar">
        <div className="top-bar-row">
          <Link href="/" className="icon-btn icon-btn-plain" aria-label="Back to jobs">
            <ChevronIcon direction="left" />
          </Link>
          <p className="sr-only">Loading</p>
        </div>
      </header>
      <main className="app-scroll">
        <div className="skeleton skeleton-where" />
        <div className="skeleton skeleton-customer" />
        <div className="skeleton skeleton-note" />
        <div className="skeleton skeleton-note" />
        <div className="skeleton skeleton-note" />
      </main>
      <div className="action-bar">
        <button type="button" className="note-launcher" disabled>
          Add a note…
        </button>
        <button type="button" className="icon-btn" disabled aria-label="Previous job">
          <ChevronIcon direction="up" />
        </button>
        <button type="button" className="icon-btn" disabled aria-label="Next job">
          <ChevronIcon direction="down" />
        </button>
      </div>
      <TabBar />
    </div>
  );
}
