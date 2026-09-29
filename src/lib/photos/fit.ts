/** Long edge of a phone photo before it is stored. */
export const PHOTO_MAX_EDGE = 1600;

/** JPEG quality written by the phone. Canvas export drops EXIF, including location. */
export const PHOTO_JPEG_QUALITY = 0.8;

export function fittedSize(
  width: number,
  height: number,
  maxEdge = PHOTO_MAX_EDGE,
): { width: number; height: number } {
  if (width <= 0 || height <= 0 || maxEdge <= 0) return { width: 1, height: 1 };
  const longEdge = Math.max(width, height);
  if (longEdge <= maxEdge) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxEdge / longEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
