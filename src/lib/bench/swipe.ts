/** Jobs-list swipe. Pure, same style as the scroll-lock decision. No note swipes. */

export const SWIPE_DEAD_ZONE = 24;
export const SWIPE_LOCK_DISTANCE = 12;
/** tan(30°). Horizontal only when |dy| is within this fraction of |dx|. */
export const SWIPE_ANGLE = 0.577;
export const SWIPE_REVEAL = 96 as const;
export const SWIPE_OPEN_DISTANCE = 40;
/** px per ms. A faster leftward flick opens the reveal. */
export const SWIPE_OPEN_VELOCITY = 0.5;
export const SWIPE_RUBBER = 0.4;
export const SWIPE_MAX_DRAG = 144;
export const SWIPE_SCROLL_CLOSE = 8;

export type SwipeAxis = "undecided" | "horizontal" | "vertical";

export type SwipePhase = "move" | "end" | "cancel";

export type SwipeGesture = {
  startX: number;
  startY: number;
  x: number;
  y: number;
  viewportWidth: number;
  cardWidth: number;
  /** Positive when the finger is moving left, in px/ms. */
  velocity: number;
  reducedMotion: boolean;
  axis: SwipeAxis;
};

export type SwipeDecision = {
  ignore: boolean;
  axis: SwipeAxis;
  /** Follow-the-finger translation. 0 when the gesture is not a horizontal drag. */
  offset: number;
  /** Set when the gesture ends or is cancelled. Null while it is still moving. */
  snap: 0 | -96 | null;
  openSheet: boolean;
};

export function swipeInDeadZone(startX: number, viewportWidth: number): boolean {
  return startX < SWIPE_DEAD_ZONE || startX > viewportWidth - SWIPE_DEAD_ZONE;
}

export function isArchiveStatus(status: string): status is "collected" | "closed_no_repair" {
  return status === "collected" || status === "closed_no_repair";
}

function lockAxis(gesture: SwipeGesture): SwipeAxis {
  if (gesture.axis !== "undecided") return gesture.axis;
  const dx = gesture.x - gesture.startX;
  const dy = gesture.y - gesture.startY;
  if (Math.hypot(dx, dy) < SWIPE_LOCK_DISTANCE) return "undecided";
  if (Math.abs(dy) <= SWIPE_ANGLE * Math.abs(dx)) return "horizontal";
  return "vertical";
}

function resistedOffset(dx: number, reducedMotion: boolean): number {
  const left = Math.min(0, dx);
  if (left >= -SWIPE_REVEAL) return left;
  if (reducedMotion) return -SWIPE_REVEAL;
  const extra = left + SWIPE_REVEAL;
  return Math.max(-SWIPE_REVEAL + extra * SWIPE_RUBBER, -SWIPE_MAX_DRAG);
}

export function swipeDecision(phase: SwipePhase, gesture: SwipeGesture): SwipeDecision {
  if (swipeInDeadZone(gesture.startX, gesture.viewportWidth)) {
    return { ignore: true, axis: gesture.axis, offset: 0, snap: 0, openSheet: false };
  }
  if (phase === "cancel") {
    return { ignore: false, axis: gesture.axis, offset: 0, snap: 0, openSheet: false };
  }

  const axis = lockAxis(gesture);
  if (axis === "undecided") {
    return { ignore: false, axis, offset: 0, snap: phase === "end" ? 0 : null, openSheet: false };
  }
  if (axis === "vertical") {
    return { ignore: false, axis, offset: 0, snap: phase === "end" ? 0 : null, openSheet: false };
  }

  const dx = gesture.x - gesture.startX;
  if (phase === "move") {
    return { ignore: false, axis, offset: resistedOffset(dx, gesture.reducedMotion), snap: null, openSheet: false };
  }

  const travelLeft = Math.max(0, -dx);
  if (gesture.cardWidth > 0 && travelLeft > gesture.cardWidth * 0.5) {
    return { ignore: false, axis, offset: 0, snap: 0, openSheet: true };
  }
  const open = travelLeft >= SWIPE_OPEN_DISTANCE || gesture.velocity > SWIPE_OPEN_VELOCITY;
  const snap: 0 | -96 = open ? -96 : 0;
  return { ignore: false, axis, offset: 0, snap, openSheet: false };
}
