-- Retired. The ticket bench schema has been replaced.
-- In the Supabase SQL editor, run:
--   supabase/migrations/20260929120000_jobs.sql
-- That file drops the old customers, devices, tickets and ticket_notes tables.

do $$
begin
  raise exception
    'supabase/schema.sql is retired. Run supabase/migrations/20260929120000_jobs.sql instead.';
end
$$;
