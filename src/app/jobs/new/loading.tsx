import { TabBar } from "@/app/bench/tab-bar";

export default function NewJobLoading() {
  return (
    <div className="app-frame" aria-busy="true">
      <header className="top-bar">
        <div className="top-bar-row top-bar-row-plain">
          <p className="top-bar-title top-bar-title-md">New job</p>
        </div>
      </header>
      <main className="app-scroll">
        <p className="sr-only">Loading</p>
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-line" />
      </main>
      <div className="action-bar">
        <button className="tech-btn-primary" type="button" disabled>
          Create job
        </button>
      </div>
      <TabBar />
    </div>
  );
}
