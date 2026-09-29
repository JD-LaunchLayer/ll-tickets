import type { Photo } from "@/lib/jobs/domain";

export type SignedPhoto = {
  id: string;
  url: string;
  caption: string | null;
  takenAt: string;
};

/** Newest first. The signed URL is the only location sent to the phone. */
export async function signJobPhotos(
  photos: readonly Photo[],
  sign: (storagePath: string) => Promise<string>,
): Promise<SignedPhoto[]> {
  const newestFirst = [...photos].sort((a, b) =>
    a.takenAt < b.takenAt ? 1 : a.takenAt > b.takenAt ? -1 : 0,
  );
  const signed: SignedPhoto[] = [];
  for (const photo of newestFirst) {
    signed.push({
      id: photo.id,
      url: await sign(photo.storagePath),
      caption: photo.caption,
      takenAt: photo.takenAt,
    });
  }
  return signed;
}
