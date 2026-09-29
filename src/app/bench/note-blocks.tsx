import {
  parseNoteBody,
  type InlineRun,
  type NoteBlock,
  type NoteListItem,
} from "@/lib/bench/note-view";

function Inlines({ runs }: { runs: InlineRun[] }) {
  return runs.map((run, index) =>
    run.bold ? (
      <b key={index}>{run.text}</b>
    ) : (
      <span key={index}>{run.text}</span>
    ),
  );
}

function ItemLines({ item }: { item: NoteListItem }) {
  return item.lines.map((line, index) => (
    <span key={index}>
      {index > 0 ? <br /> : null}
      <Inlines runs={line} />
    </span>
  ));
}

function blocksFor(text: string): { blocks: NoteBlock[]; fallback: boolean } {
  try {
    const blocks = parseNoteBody(text);
    if (blocks.length === 0) return { blocks, fallback: text.length > 0 };
    return { blocks, fallback: false };
  } catch {
    return { blocks: [], fallback: true };
  }
}

function ReplyBlock({ block }: { block: NoteBlock }) {
  if (block.type === "heading") return <h3>{block.text}</h3>;
  if (block.type === "ul") {
    return (
      <ul>
        {block.items.map((item, index) => (
          <li key={index}>
            <ItemLines item={item} />
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === "ol") {
    return (
      <ol start={block.start}>
        {block.items.map((item, index) => (
          <li key={index}>
            <ItemLines item={item} />
          </li>
        ))}
      </ol>
    );
  }
  return (
    <p>
      <Inlines runs={block.runs} />
    </p>
  );
}

export function ReplyBlocks({ text }: { text: string }) {
  const { blocks, fallback } = blocksFor(text);
  if (fallback) return <p className="note-fallback">{text}</p>;
  if (blocks.length === 0) return null;
  return (
    <div className="reply">
      {blocks.map((block, index) => (
        <ReplyBlock key={index} block={block} />
      ))}
    </div>
  );
}

export function NoteBody({ text, lead = false }: { text: string; lead?: boolean }) {
  const { blocks, fallback } = blocksFor(text);
  if (fallback) return <p className="note-fallback">{text}</p>;
  const leadIndex = lead ? blocks.findIndex((block) => block.type === "p") : -1;
  return (
    <>
      {blocks.map((block, index) => {
        if (block.type === "heading") return <h3 key={index}>{block.text}</h3>;
        if (block.type === "p") {
          const isLead = index === leadIndex;
          return (
            <p key={index} className={isLead ? "note-detail-lead" : undefined}>
              <Inlines runs={block.runs} />
            </p>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={index} className="note-steps" role="list">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="note-step">
                  <span className="note-step-bullet" aria-hidden="true" />
                  <span className="note-step-text">
                    <ItemLines item={item} />
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        return (
          <ol key={index} className="note-steps" role="list" start={block.start}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex} className="note-step">
                <span className="note-step-mark">{block.start + itemIndex}</span>
                <span className="note-step-text">
                  <ItemLines item={item} />
                </span>
              </li>
            ))}
          </ol>
        );
      })}
    </>
  );
}
