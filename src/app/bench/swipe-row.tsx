"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { ArchiveChrome, useArchive, type ArchiveTarget } from "@/app/bench/archive-sheet";
import {
  SWIPE_REVEAL,
  SWIPE_SCROLL_CLOSE,
  swipeDecision,
  swipeInDeadZone,
  type SwipeAxis,
  type SwipeGesture,
} from "@/lib/bench/swipe";
import type { BenchListRow } from "@/lib/bench/jobs";

const ArchiveContext = createContext<ReturnType<typeof useArchive> | null>(null);

export function ArchiveController({ children }: { children: React.ReactNode }) {
  const archive = useArchive();
  return (
    <ArchiveContext.Provider value={archive}>
      {children}
      <ArchiveChrome
        toast={archive.toast}
        sheet={archive.sheet}
        pending={archive.pending}
        onUndo={() => void archive.undo()}
        onClose={archive.closeArchive}
        onChoose={(status) => void archive.commit(status)}
      />
    </ArchiveContext.Provider>
  );
}

function targetOf(row: BenchListRow): ArchiveTarget {
  return {
    ref: row.ref,
    customerName: row.customerName,
    deviceLabel: row.deviceLabel,
    status: row.status,
  };
}

type Track = {
  id: number;
  startX: number;
  startY: number;
  lastX: number;
  lastT: number;
  velocity: number;
  axis: SwipeAxis;
};

export function SwipeRow({ row, children }: { row: BenchListRow; children: React.ReactNode }) {
  const archive = useContext(ArchiveContext);
  const liRef = useRef<HTMLLIElement>(null);
  const track = useRef<Track | null>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const suppressClick = useRef(false);
  const revealed = archive?.openRef === row.ref;
  const shown = dragging ? offset : revealed ? -SWIPE_REVEAL : 0;

  const closeSwipe = archive?.closeSwipe;
  useEffect(() => {
    if (!revealed || !closeSwipe) return;
    const scroller = document.querySelector(".app-scroll");
    const start = scroller instanceof HTMLElement ? scroller.scrollTop : 0;
    const onScroll = () => {
      if (!(scroller instanceof HTMLElement)) return;
      if (Math.abs(scroller.scrollTop - start) > SWIPE_SCROLL_CLOSE) closeSwipe();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSwipe();
    };
    const onPointer = (event: PointerEvent) => {
      if (!liRef.current?.contains(event.target as Node)) closeSwipe();
    };
    scroller?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      scroller?.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [revealed, closeSwipe]);

  if (!archive) return <li>{children}</li>;
  if (archive.hidden[row.ref]) return null;

  function gesture(current: Track, event: React.PointerEvent): SwipeGesture {
    return {
      startX: current.startX,
      startY: current.startY,
      x: event.clientX,
      y: event.clientY,
      viewportWidth: window.innerWidth,
      cardWidth: liRef.current?.clientWidth ?? 0,
      velocity: current.velocity,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      axis: current.axis,
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLLIElement>) {
    if (!archive || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest(".job-more, .swipe-archive, .archive-retry")) return;
    if (swipeInDeadZone(event.clientX, window.innerWidth)) return;
    track.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastT: event.timeStamp,
      velocity: 0,
      axis: "undecided",
    };
  }

  function onPointerMove(event: React.PointerEvent<HTMLLIElement>) {
    const current = track.current;
    if (!current || event.pointerId !== current.id) return;
    const dt = event.timeStamp - current.lastT;
    if (dt > 0) current.velocity = (current.lastX - event.clientX) / dt;
    current.lastX = event.clientX;
    current.lastT = event.timeStamp;
    const decision = swipeDecision("move", gesture(current, event));
    current.axis = decision.axis;
    if (decision.ignore || decision.axis === "vertical") {
      track.current = null;
      setDragging(false);
      setOffset(0);
      return;
    }
    if (decision.axis === "horizontal") {
      setDragging(true);
      setOffset(decision.offset);
    }
  }

  function finish(event: React.PointerEvent<HTMLLIElement>, phase: "end" | "cancel") {
    const current = track.current;
    if (!archive || !current || event.pointerId !== current.id) return;
    const decision = swipeDecision(phase, gesture(current, event));
    track.current = null;
    setDragging(false);
    if (decision.ignore) {
      setOffset(0);
      return;
    }
    if (decision.openSheet) {
      archive.openArchive(targetOf(row));
      return;
    }
    if (decision.snap === -SWIPE_REVEAL) {
      suppressClick.current = true;
      archive.reveal(row.ref);
    } else archive.closeSwipe();
  }

  function onClickCapture(event: React.MouseEvent) {
    if (suppressClick.current) {
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!archive || !revealed) return;
    const target = event.target as HTMLElement;
    if (target.closest(".job-more, .swipe-archive")) return;
    event.preventDefault();
    event.stopPropagation();
    archive.closeSwipe();
  }

  const failed = archive.failure?.target.ref === row.ref;

  return (
    <li
      ref={liRef}
      className="swipe-item"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => finish(event, "end")}
      onPointerCancel={(event) => finish(event, "cancel")}
    >
      <button
        type="button"
        className="swipe-archive"
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => archive.openArchive(targetOf(row))}
      >
        Archive
      </button>
      <div
        className={dragging ? "swipe-face is-dragging" : "swipe-face"}
        style={{ transform: `translate3d(${shown}px, 0, 0)` }}
        onClickCapture={onClickCapture}
      >
        {children}
        <button
          type="button"
          className="icon-btn job-more"
          aria-label={`Actions for ${row.customerName}, ${row.ref}`}
          aria-haspopup="dialog"
          onClick={() => archive.openArchive(targetOf(row))}
        >
          <span className="job-more-mark" aria-hidden="true">
            ⋯
          </span>
        </button>
      </div>
      {failed ? (
        <button type="button" className="archive-retry" onClick={archive.retry}>
          Not archived. Retry.
        </button>
      ) : null}
    </li>
  );
}
