import Link from "next/link";
import { BrandMark } from "@/app/bench/brand-mark";
import { TabBar } from "@/app/bench/tab-bar";

export default function JobNotFound() {
  return (
    <div className="app-frame">
      <header className="app-header">
        <div className="app-header-row">
          <BrandMark />
        </div>
      </header>
      <main className="app-scroll">
        <h1 className="page-title">Not on the bench</h1>
        <div className="error-panel" role="alert">
          <p className="error-panel-message">That job is not on the bench.</p>
          <Link href="/" className="text-link">
            Back to jobs
          </Link>
        </div>
      </main>
      <TabBar />
    </div>
  );
}
