import Link from "next/link";
import { ChevronIcon } from "@/app/bench/icons";
import { TabBar } from "@/app/bench/tab-bar";

export default function JobAskLoading() {
  return (
    <div className="app-frame" aria-busy="true">
      <header className="top-bar">
        <div className="top-bar-row">
          <Link href="/" className="icon-btn icon-btn-plain" aria-label="Back to jobs">
            <ChevronIcon direction="left" />
          </Link>
          <p className="top-bar-title top-bar-title-md">Ask</p>
        </div>
      </header>
      <main className="app-scroll">
        <p className="sr-only">Loading</p>
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-card" />
      </main>
      <TabBar />
    </div>
  );
}
