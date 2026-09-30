"use client";

import { useCallback, useState } from "react";
import { archiveJobAction, setStatusAction } from "@/app/bench/actions";
import { Sheet } from "@/app/bench/sheet";
import { UndoToast } from "@/app/bench/undo-toast";
import { idleForm } from "@/lib/bench/form-state";
import { isArchiveStatus } from "@/lib/bench/swipe";
import { STATUS_LABELS, type JobStatus } from "@/lib/jobs/domain";

export type ArchiveTarget = {
  ref: string;
  customerName: string;
  deviceLabel: string;
  status: JobStatus;
};

type ToastState = {
  token: number;
  ref: string;
  previous: JobStatus;
  label: string;
};

type Failure = {
  target: ArchiveTarget;
  status: "collected" | "closed_no_repair";
};

function omitRef(current: Record<string, true>, ref: string): Record<string, true> {
  const next: Record<string, true> = {};
  for (const key of Object.keys(current)) {
    if (key !== ref) next[key] = true;
  }
  return next;
}

export function useArchive() {
  const [hidden, setHidden] = useState<Record<string, true>>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [sheet, setSheet] = useState<ArchiveTarget | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pending, setPending] = useState(false);
  const [openRef, setOpenRef] = useState<string | null>(null);

  const reveal = useCallback((ref: string) => setOpenRef(ref), []);
  const closeSwipe = useCallback(() => setOpenRef(null), []);

  function openArchive(target: ArchiveTarget) {
    setOpenRef(null);
    setSheet(target);
  }

  function closeArchive() {
    if (pending) return;
    setSheet(null);
  }

  async function commit(status: "collected" | "closed_no_repair") {
    if (!sheet || pending || !isArchiveStatus(status)) return;
    const target = sheet;
    setPending(true);
    setSheet(null);
    setFailure(null);
    setOpenRef(null);
    setHidden((current) => ({ ...current, [target.ref]: true }));
    const token = Date.now();
    setToast({ token, ref: target.ref, previous: target.status, label: STATUS_LABELS[status] });
    let failed = false;
    try {
      const result = await archiveJobAction({ ref: target.ref, status });
      if (!result.ok) failed = true;
      else {
        setToast((current) =>
          current && current.token === token ? { ...current, previous: result.previous } : current,
        );
      }
    } catch {
      failed = true;
    }
    if (failed) {
      setHidden((current) => omitRef(current, target.ref));
      setToast(null);
      setFailure({ target, status });
    }
    setPending(false);
  }

  async function undo() {
    if (!toast || pending) return;
    const current = toast;
    setPending(true);
    setToast(null);
    setHidden((hiddenRefs) => omitRef(hiddenRefs, current.ref));
    const data = new FormData();
    data.set("ref", current.ref);
    data.set("status", current.previous);
    try {
      await setStatusAction(idleForm, data);
    } catch {
      setHidden((hiddenRefs) => ({ ...hiddenRefs, [current.ref]: true }));
      setToast(current);
    }
    setPending(false);
  }

  function retry() {
    if (!failure) return;
    setSheet(failure.target);
  }

  return {
    hidden,
    failure,
    sheet,
    toast,
    pending,
    openRef,
    reveal,
    closeSwipe,
    openArchive,
    closeArchive,
    commit,
    undo,
    retry,
  };
}

export function ArchiveSheet({
  target,
  pending,
  onClose,
  onChoose,
}: {
  target: ArchiveTarget | null;
  pending: boolean;
  onClose: () => void;
  onChoose: (status: "collected" | "closed_no_repair") => void;
}) {
  return (
    <Sheet open={target !== null} title={target ? `Archive ${target.ref}` : "Archive"} onClose={onClose}>
      {target ? (
        <div className="archive-sheet">
          <p className="archive-sub">
            {target.customerName}
            {" · "}
            {target.deviceLabel}
          </p>
          <div className="archive-choices">
            <button type="button" className="archive-choice" disabled={pending} onClick={() => onChoose("collected")}>
              <span className="archive-label">Collected</span>
              <span className="archive-help">Customer has the device</span>
            </button>
            <button
              type="button"
              className="archive-choice"
              disabled={pending}
              onClick={() => onChoose("closed_no_repair")}
            >
              <span className="archive-label">Closed, no repair</span>
              <span className="archive-help">Declined, uneconomic or abandoned</span>
            </button>
          </div>
          <button type="button" className="tech-btn-quiet archive-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
      ) : null}
    </Sheet>
  );
}

export function ArchiveChrome({
  toast,
  sheet,
  pending,
  onUndo,
  onClose,
  onChoose,
}: {
  toast: ToastState | null;
  sheet: ArchiveTarget | null;
  pending: boolean;
  onUndo: () => void;
  onClose: () => void;
  onChoose: (status: "collected" | "closed_no_repair") => void;
}) {
  return (
    <>
      <ArchiveSheet target={sheet} pending={pending} onClose={onClose} onChoose={onChoose} />
      <UndoToast
        message={toast ? `Archived ${toast.ref} as ${toast.label}` : null}
        token={toast?.token ?? null}
        onUndo={onUndo}
      />
    </>
  );
}
