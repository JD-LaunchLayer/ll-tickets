import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { JOB_PHOTOS_BUCKET } from "@/lib/photos/signed-url";

export async function purgeExpiredPhotos(
  client: SupabaseClient<Database>,
): Promise<{ deleted: number }> {
  const { data, error } = await client.rpc("list_expired_job_photos");
  if (error) throw new Error("Could not list expired photos.");
  const rows = data ?? [];
  if (rows.length === 0) return { deleted: 0 };
  const paths = rows.map((row) => row.storage_path);
  const { error: storageError } = await client.storage.from(JOB_PHOTOS_BUCKET).remove(paths);
  if (storageError) throw new Error("Could not delete expired photo files.");
  const { error: deleteError } = await client.from("photos").delete().in(
    "id",
    rows.map((row) => row.id),
  );
  if (deleteError) throw new Error("Could not delete expired photo rows.");
  return { deleted: rows.length };
}
