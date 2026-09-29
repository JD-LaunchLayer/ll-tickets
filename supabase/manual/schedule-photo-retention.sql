-- Optional. Prefer the application route /api/cron/purge-photos, which deletes
-- files through the Storage API. This file is the manual alternative if that
-- route is not scheduled for you.
--
-- One manual step: in the Supabase dashboard, enable the pg_cron extension,
-- then run this file in the SQL editor.
--
-- I could not verify that deleting storage.objects on your project also removes
-- the file bytes. After the first run, open Storage → job-photos and confirm the
-- old objects are gone. If they remain, use /api/cron/purge-photos instead.

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'purge-expired-job-photos',
  '15 3 * * *',
  $$select public.purge_expired_job_photos()$$
);
