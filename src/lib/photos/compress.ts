import { fittedSize, PHOTO_JPEG_QUALITY, PHOTO_MAX_EDGE } from "@/lib/photos/fit";

/**
 * Draws the photo onto a canvas and exports a new JPEG.
 * That file has no EXIF segment, so location and other camera metadata are not uploaded.
 * Orientation is applied by createImageBitmap before the pixels are drawn.
 */
export async function compressPhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const size = fittedSize(bitmap.width, bitmap.height, PHOTO_MAX_EDGE);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the photo.");
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", PHOTO_JPEG_QUALITY);
    });
    if (!blob) throw new Error("Could not prepare the photo.");
    return blob;
  } finally {
    bitmap.close();
  }
}
