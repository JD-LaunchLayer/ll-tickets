import Link from "next/link";
import { BrandMark } from "@/app/bench/brand-mark";
import { TabBar } from "@/app/bench/tab-bar";
import { signOut } from "@/app/login/actions";

export function BenchShell({
  title,
  children,
  backHref,
  backLabel = "Jobs",
  showSignOut = false,
  fill = false,
  dock,
}: {
  title: string;
  children: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  showSignOut?: boolean;
  fill?: boolean;
  dock?: React.ReactNode;
}) {
  return (
    <div className="app-frame">
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
      <div className={fill ? "app-scroll app-scroll-fill" : "app-scroll"}>
        <h1 className="page-title">{title}</h1>
        {fill ? <div className="fill-rest">{children}</div> : children}
      </div>
      {dock ? <div className="dock">{dock}</div> : null}
      <TabBar />
    </div>
  );
}
