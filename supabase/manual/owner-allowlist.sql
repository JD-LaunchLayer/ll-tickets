-- Run once in the Supabase SQL editor after the jobs migration.
-- Use the same address as OWNER_EMAIL, in lowercase.
-- Until this row exists, signed-in requests cannot read or write workshop rows.

insert into private.owner_allowlist (email)
values (lower('owner@example.com'))
on conflict (email) do nothing;
