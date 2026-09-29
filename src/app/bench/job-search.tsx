"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CloseIcon } from "@/app/bench/icons";
import type { BenchView } from "@/lib/bench/filters";

export function JobSearch({
  q,
  view,
  finished,
}: {
  q: string;
  view: BenchView;
  finished: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(q);

  function clear() {
    setValue("");
    const params = new URLSearchParams();
    if (view !== "bench") params.set("view", view);
    if (finished) params.set("finished", "1");
    const query = params.toString();
    router.push(query ? `/?${query}` : "/");
  }

  return (
    <form action="/" method="get" className="search-form">
      {view !== "bench" ? <input type="hidden" name="view" value={view} /> : null}
      {finished ? <input type="hidden" name="finished" value="1" /> : null}
      <div className="search-field">
        <label className="sr-only" htmlFor="job-search">
          Search
        </label>
        <input
          id="job-search"
          name="q"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Name, device or ref"
          autoComplete="off"
          enterKeyHint="search"
        />
        {value ? (
          <button className="search-clear" type="button" onClick={clear} aria-label="Clear search">
            <CloseIcon />
          </button>
        ) : null}
      </div>
    </form>
  );
}
