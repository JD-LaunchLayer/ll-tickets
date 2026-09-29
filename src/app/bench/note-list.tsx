"use client";

import { useEffect, useState } from "react";
import { formatBenchTime } from "@/lib/bench/format";
import { NOTE_TAG_LABELS, type NoteTag } from "@/lib/jobs/domain";

export type NoteRow = {
  id: string;
  text: string;
  tag: NoteTag | null;
  createdAt: string;
  editedAt: string | null;
};

function tagLabel(tag: NoteTag | null): string {
  return tag ? NOTE_TAG_LABELS[tag] : "Untagged";
}

export function NoteList({ jobRef, notes }: { jobRef: string; notes: NoteRow[] }) {
  const [freshId, setFreshId] = useState<string | null>(null);

  useEffect(() => {
    let timer = 0;
    const apply = () => {
      if (sessionStorage.getItem("ll-fresh") !== jobRef) return;
      setFreshId(notes[0]?.id ?? null);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        sessionStorage.removeItem("ll-fresh");
        setFreshId(null);
      }, 2000);
    };
    const start = window.setTimeout(apply, 0);
    window.addEventListener("ll-note-filed", apply);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(timer);
      window.removeEventListener("ll-note-filed", apply);
    };
  }, [jobRef, notes]);

  if (notes.length === 0) {
    return <p className="muted">No notes yet. Add the first one below.</p>;
  }

  return (
    <ul className="timeline">
      {notes.map((note) => (
        <li key={note.id} id={`note-${note.id}`} className={note.id === freshId ? "note-row note-fresh" : "note-row"}>
          <p className="note-meta">
            {tagLabel(note.tag)} · <time dateTime={note.createdAt}>{formatBenchTime(note.createdAt)}</time>
          </p>
          <p className="note-text">{note.text}</p>
          {note.editedAt ? <p className="note-meta">Edited {formatBenchTime(note.editedAt)}</p> : null}
        </li>
      ))}
    </ul>
  );
}
