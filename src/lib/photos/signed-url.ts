import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const JOB_PHOTOS_BUCKET = "job-photos";

/** Short-lived access for the owner. The Action API must not call this. */
export const PHOTO_SIGNED_URL_SECONDS = 300;

export async function createPrivatePhotoUrl(
  client: SupabaseClient<Database>,
  storagePath: string,
): Promise<string> {
  const { data, error } = await client.storage
    .from(JOB_PHOTOS_BUCKET)
    .createSignedUrl(storagePath, PHOTO_SIGNED_URL_SECONDS);
  if (error || !data?.signedUrl) {
    throw new Error("Could not create a signed photo URL.");
  }
  return data.signedUrl;
}
