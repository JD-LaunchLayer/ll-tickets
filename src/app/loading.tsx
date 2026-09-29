import { BrandMark } from "@/app/bench/brand-mark";

export default function Loading() {
  return (
    <div className="app-frame" aria-busy="true">
      <header className="app-header">
        <div className="app-header-row">
          <BrandMark />
        </div>
      </header>
      <div className="app-scroll">
        <p className="sr-only">Loading</p>
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
      </div>
      <div className="tab-bar" aria-hidden="true">
        <span className="tab-link">Jobs</span>
        <span className="tab-link">New job</span>
        <span className="tab-link">Ask</span>
      </div>
    </div>
  );
}
