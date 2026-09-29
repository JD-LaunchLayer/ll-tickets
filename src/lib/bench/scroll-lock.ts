export type DocumentMoveInput = {
  /** More than one finger: pinch-zoom must keep working. */
  pinch: boolean;
  /** Keyboard is up, or the short viewport has released the document lock. */
  relaxed: boolean;
  /** Text field, native select, or editable content. Do not cancel the gesture. */
  editable: boolean;
  /** Touch started in .app-scroll, the note sheet, the Ask chat list, or the new-job form. */
  inScrollable: boolean;
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  /** Finger travel since touchstart. Positive means the finger moved down. */
  deltaY: number;
};

/**
 * True when the touch would drag the document rather than scroll a region.
 * Chrome (top bar, tab bar, action bar, sheet backdrop) is not scrollable.
 * A scrollable region is blocked only at its edges, or when it has nothing to scroll.
 */
export function shouldPreventDocumentMove(input: DocumentMoveInput): boolean {
  if (input.pinch || input.relaxed || input.editable) return false;
  if (!input.inScrollable) return true;
  const room = input.scrollHeight - input.clientHeight;
  if (room <= 1) return true;
  const atTop = input.scrollTop <= 0;
  const atBottom = input.scrollTop + input.clientHeight >= input.scrollHeight - 1;
  if (atTop && input.deltaY > 0) return true;
  if (atBottom && input.deltaY < 0) return true;
  return false;
}
