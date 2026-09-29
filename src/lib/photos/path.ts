export const PHOTO_MAX_BYTES = 3_000_000;

const PHOTO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Private object key. Job id and photo id only, so a path cannot escape the job. */
export function jobPhotoPath(jobId: string, photoId: string): string {
  if (!PHOTO_ID.test(jobId) || !PHOTO_ID.test(photoId)) {
    throw new Error("Photo path needs a job id and a photo id.");
  }
  return `${jobId.toLowerCase()}/${photoId.toLowerCase()}.jpg`;
}

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}
