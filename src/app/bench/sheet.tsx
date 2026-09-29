"use client";

import { useEffect, useId, useImperativeHandle, useRef } from "react";
import { CloseIcon } from "@/app/bench/icons";
import { useBenchUi } from "@/app/bench/providers";

export type SheetHandle = {
  /** Drop inert in the same tap so a field inside can take focus and raise the keyboard. */
  prepare: () => void;
};

function focusable(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")].filter(
    (node) => !node.closest("[inert]") && node.getClientRects().length > 0,
  );
}

export function Sheet({
  ref,
  open,
  title,
  onClose,
  children,
  showClose = true,
  initialFocusRef,
  restoreFocusRef,
}: {
  ref?: React.Ref<SheetHandle>;
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  showClose?: boolean;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  restoreFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  const layerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { pushSheet, popSheet } = useBenchUi();

  useImperativeHandle(ref, () => ({
    prepare() {
      if (layerRef.current) layerRef.current.inert = false;
    },
  }));

  useEffect(() => {
    if (!open) return;
    pushSheet();
    const restore = restoreFocusRef?.current ?? null;
    const focusTimer = window.setTimeout(() => {
      initialFocusRef?.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(focusTimer);
      popSheet();
      restore?.focus();
    };
  }, [open, initialFocusRef, restoreFocusRef, pushSheet, popSheet]);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !layerRef.current) return;
    const nodes = focusable(layerRef.current);
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !layerRef.current.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      ref={layerRef}
      className="sheet-layer"
      data-open={open ? "true" : "false"}
      inert={open ? undefined : true}
      onKeyDown={onKeyDown}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-hidden={open ? undefined : true}>
        <div className="sheet-title-row">
          <h2 id={titleId} className="sheet-title">
            {title}
          </h2>
          {showClose ? (
            <button className="icon-btn icon-btn-plain" type="button" aria-label="Close" onClick={onClose}>
              <CloseIcon />
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
