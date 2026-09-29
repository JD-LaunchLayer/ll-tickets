export type ReplyBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

const UNORDERED = /^[-*•]\s+(.+)$/;
const ORDERED = /^\d+[.)]\s+(.+)$/;

/** Paragraphs and simple lists, so a long diagnosis stays scannable. */
export function splitReply(text: string): ReplyBlock[] {
  const blocks: ReplyBlock[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;

  function flushParagraph() {
    const joined = paragraph.join(" ").replace(/\s+/g, " ").trim();
    paragraph = [];
    if (joined) blocks.push({ type: "p", text: joined });
  }

  function flushList() {
    if (list && list.items.length > 0) blocks.push(list);
    list = null;
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      flushParagraph();
      continue;
    }
    const unordered = UNORDERED.exec(line);
    const ordered = ORDERED.exec(line);
    if (unordered) {
      flushParagraph();
      if (!list || list.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(unordered[1]);
      continue;
    }
    if (ordered) {
      flushParagraph();
      if (!list || list.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(ordered[1]);
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushList();
  flushParagraph();
  return blocks;
}
