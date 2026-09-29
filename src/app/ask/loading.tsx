import { TabBar } from "@/app/bench/tab-bar";

export default function AskLoading() {
  return (
    <div className="app-frame" aria-busy="true">
      <header className="top-bar">
        <div className="top-bar-row top-bar-row-plain">
          <p className="top-bar-title top-bar-title-md">Ask the record</p>
        </div>
      </header>
      <main className="app-scroll">
        <p className="sr-only">Loading</p>
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-card" />
      </main>
      <TabBar />
    </div>
  );
}
