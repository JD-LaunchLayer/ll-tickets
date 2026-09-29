import { PlainTopBar } from "@/app/bench/top-bar";
import { TabBar } from "@/app/bench/tab-bar";

export default function NotFound() {
  return (
    <div className="app-frame">
      <PlainTopBar title="Not found" showSignOut />
      <div className="app-scroll">
        <div className="error-panel" role="alert">
          <p className="error-panel-message">That page is not on the bench.</p>
        </div>
      </div>
      <TabBar />
    </div>
  );
}
