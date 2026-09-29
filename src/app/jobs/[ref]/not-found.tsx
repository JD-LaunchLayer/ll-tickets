import Link from "next/link";
import { PlainTopBar } from "@/app/bench/top-bar";
import { TabBar } from "@/app/bench/tab-bar";

export default function JobNotFound() {
  return (
    <div className="app-frame">
      <PlainTopBar title="Not on the bench" showSignOut />
      <main className="app-scroll">
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
