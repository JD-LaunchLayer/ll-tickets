import { BrandMark } from "@/app/bench/brand-mark";
import { TabBar } from "@/app/bench/tab-bar";

export default function NotFound() {
  return (
    <div className="app-frame">
      <header className="app-header">
        <div className="app-header-row">
          <BrandMark />
        </div>
      </header>
      <div className="app-scroll">
        <h1 className="page-title">Not found</h1>
        <div className="error-panel" role="alert">
          <p className="error-panel-message">That page is not on the bench.</p>
        </div>
      </div>
      <TabBar />
    </div>
  );
}
