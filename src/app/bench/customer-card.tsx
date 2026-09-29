"use client";

import { useState } from "react";
import { ChevronIcon, PhoneIcon } from "@/app/bench/icons";

export function CustomerCard({
  name,
  device,
  phone,
  call,
  fault,
  startOpen,
}: {
  name: string;
  device: string;
  phone: string | null;
  call: string | null;
  fault: string;
  startOpen: boolean;
}) {
  const [open, setOpen] = useState(startOpen);

  return (
    <section className="customer-card" aria-label="Customer">
      <div className="customer-row">
        <div className="customer-main">
          <p className="customer-name">{name}</p>
          <p className="job-device-line">{device}</p>
        </div>
        {call ? (
          <a className="call-btn" href={call} aria-label={`Call ${name}`}>
            <PhoneIcon />
            Call
          </a>
        ) : null}
        <button
          type="button"
          className="icon-btn icon-btn-plain"
          aria-expanded={open}
          aria-label={open ? "Hide job details" : "Show job details"}
          onClick={() => setOpen((value) => !value)}
        >
          <ChevronIcon direction={open ? "up" : "down"} />
        </button>
      </div>
      {open ? (
        <div className="customer-more">
          {phone ? <p>{phone}</p> : <p className="muted">No phone number</p>}
          <p className="field-label">Reported fault</p>
          <p className="note-text">{fault}</p>
        </div>
      ) : null}
    </section>
  );
}
