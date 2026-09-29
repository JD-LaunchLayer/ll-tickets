"use client";

import { PlainTopBar } from "@/app/bench/top-bar";
import { TabBar } from "@/app/bench/tab-bar";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="app-frame">
      <PlainTopBar title="Something went wrong" showSignOut />
      <div className="app-scroll">
        <div className="error-panel" role="alert">
          <p className="error-panel-message">That failed. Try again in a moment.</p>
          <button className="tech-btn-secondary" type="button" onClick={() => reset()}>
            Try again
          </button>
        </div>
      </div>
      <TabBar />
    </div>
  );
}
