import { LoadingTopBar } from "@/app/bench/top-bar";
import { TabBar } from "@/app/bench/tab-bar";

export default function Loading() {
  return (
    <div className="app-frame" aria-busy="true">
      <LoadingTopBar />
      <div className="app-scroll">
        <p className="sr-only">Loading</p>
        <div className="skeleton skeleton-search" />
        <div className="skeleton-segments" aria-hidden="true">
          <div className="skeleton skeleton-segment" />
          <div className="skeleton skeleton-segment" />
          <div className="skeleton skeleton-segment" />
        </div>
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
      </div>
      <TabBar />
    </div>
  );
}
