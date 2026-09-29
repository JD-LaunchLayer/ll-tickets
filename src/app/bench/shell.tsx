import Link from "next/link";
import { BackToJobs } from "@/app/bench/back-button";
import { BrandMark } from "@/app/bench/brand-mark";
import { BenchFrame, OfflineBanner } from "@/app/bench/providers";
import { TabBar } from "@/app/bench/tab-bar";
import { signOut } from "@/app/login/actions";

export function BenchShell({
  title,
  children,
  chrome = "band",
  showSignOut = false,
  fill = false,
  titlePlacement = "page",
  backHref,
  backLabel = "Jobs",
  barTitleSize = "id",
  barMeta,
  barMetaLabel,
  barSubtitle,
  barAction,
  actionBar,
  dock,
  showTabs = true,
}: {
  title: string;
  children: React.ReactNode;
  chrome?: "band" | "bar";
  showSignOut?: boolean;
  fill?: boolean;
  /** page: visible h1 in the scroll. sr: h1 for assistive tech only. bar: h1 is the compact bar title. */
  titlePlacement?: "page" | "sr" | "bar";
  backHref?: string;
  backLabel?: string;
  barTitleSize?: "id" | "md";
  barMeta?: string | null;
  barMetaLabel?: string;
  barSubtitle?: string | null;
  barAction?: React.ReactNode;
  actionBar?: React.ReactNode;
  dock?: React.ReactNode;
  showTabs?: boolean;
}) {
  const scrollClass = fill ? "app-scroll app-scroll-fill" : "app-scroll";
  return (
    <BenchFrame>
      {chrome === "band" ? (
        <header className="app-header">
          <div className="app-header-row">
            {backHref ? (
              <Link href={backHref} className="header-action">
                {backLabel}
              </Link>
            ) : (
              <BrandMark />
            )}
            {backHref ? <BrandMark /> : <span />}
            {showSignOut ? (
              <form action={signOut}>
                <button className="header-action" type="submit">
                  Sign out
                </button>
              </form>
            ) : (
              <span className="header-action" aria-hidden="true" />
            )}
          </div>
        </header>
      ) : (
        <header className="top-bar">
          <div className={backHref ? "top-bar-row" : "top-bar-row top-bar-row-plain"}>
            {backHref ? <BackToJobs href={backHref} /> : null}
            {titlePlacement === "bar" ? (
              <h1 className={barTitleSize === "md" ? "top-bar-title top-bar-title-md" : "top-bar-title"}>{title}</h1>
            ) : (
              <p className="top-bar-title">{title}</p>
            )}
            {barMeta ? (
              <p className="top-bar-meta" aria-label={barMetaLabel}>
                {barMeta}
              </p>
            ) : null}
            {barAction}
          </div>
          {barSubtitle ? <p className="top-bar-sub">{barSubtitle}</p> : null}
        </header>
      )}
      <OfflineBanner />
      <main className={scrollClass}>
        {titlePlacement === "page" ? <h1 className="page-title">{title}</h1> : null}
        {titlePlacement === "sr" ? <h1 className="sr-only">{title}</h1> : null}
        {fill ? <div className="fill-rest">{children}</div> : children}
      </main>
      {dock ? <div className="dock">{dock}</div> : null}
      {actionBar ? <div className="action-bar">{actionBar}</div> : null}
      {showTabs ? <TabBar /> : null}
    </BenchFrame>
  );
}
