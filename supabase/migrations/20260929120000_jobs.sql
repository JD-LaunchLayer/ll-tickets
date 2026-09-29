-- LaunchLayer jobs record (PR 1).
-- Replaces the earlier ticket bench (customers, devices, tickets, ticket_notes).
-- Running this drops those tables. Do not run it against a database that holds real jobs.
-- Do not apply this to production from the app. Run it yourself in the Supabase SQL editor
-- or with the Supabase CLI against the project you intend to change.

create extension if not exists pgcrypto;

-- Retire the ticket MVP. Cascade removes its policies and indexes.
drop table if exists public.ticket_notes cascade;
drop table if exists public.tickets cascade;
drop table if exists public.devices cascade;
drop table if exists public.customers cascade;
drop type if exists public.note_kind;
drop type if exists public.ticket_status;
drop type if exists public.arrival_kind;

create schema if not exists private;

create table if not exists private.owner_allowlist (
  email text primary key,
  constraint owner_allowlist_lowercase check (email = lower(email))
);

comment on table private.owner_allowlist is
  'Emails allowed to read and write workshop rows. Insert Jordan''s lowercase email by hand. Empty means nobody passes row-level security.';

revoke all on schema private from public, anon, authenticated;
revoke all on table private.owner_allowlist from public, anon, authenticated;

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.owner_allowlist
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function private.is_owner() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_owner() to authenticated;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'job_status') then
    create type public.job_status as enum (
      'new',
      'diagnosing',
      'waiting_on_parts',
      'waiting_on_customer',
      'ready',
      'collected',
      'closed_no_repair'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'price_basis') then
    create type public.price_basis as enum ('estimate', 'quote');
  end if;
  if not exists (select 1 from pg_type where typname = 'backup_position') then
    create type public.backup_position as enum (
      'customer_backed_up',
      'we_backed_up',
      'not_needed',
      'not_discussed'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'note_tag') then
    create type public.note_tag as enum (
      'finding',
      'work_done',
      'parts',
      'customer_contact',
      'quote_auth',
      'other'
    );
  end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Stub so the jobs.ref default can be created before the table exists.
-- Replaced below with the uniqueness loop. Alphabet matches src/lib/jobs/ref.ts.
create or replace function public.generate_job_ref()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text := 'LL-';
  i integer;
begin
  for i in 1..4 loop
    candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return candidate;
end;
$$;

create or replace function public.set_job_closed_at()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.status in ('collected', 'closed_no_repair') then
      if old.closed_at is not null and old.status in ('collected', 'closed_no_repair') then
        new.closed_at := old.closed_at;
      else
        new.closed_at := coalesce(new.closed_at, now());
      end if;
    else
      new.closed_at := null;
    end if;
  else
    if new.status in ('collected', 'closed_no_repair') then
      new.closed_at := coalesce(new.closed_at, now());
    else
      new.closed_at := null;
    end if;
  end if;
  return new;
end;
$$;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default public.generate_job_ref(),
  customer_name text not null,
  phone text,
  device_label text not null,
  reported_fault text not null,
  status public.job_status not null default 'new',
  next_move text not null,
  price_gbp numeric(10, 2),
  price_basis public.price_basis,
  price_agreed_at timestamptz,
  backup_position public.backup_position,
  access_given boolean,
  collection_at timestamptz,
  calendar_event_id text,
  follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint jobs_ref_format check (ref ~ '^LL-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$'),
  constraint jobs_customer_name_not_blank check (char_length(trim(customer_name)) between 1 and 120),
  constraint jobs_device_label_not_blank check (char_length(trim(device_label)) between 1 and 160),
  constraint jobs_reported_fault_not_blank check (char_length(trim(reported_fault)) between 1 and 2000),
  constraint jobs_next_move_one_line check (
    char_length(trim(next_move)) between 1 and 180
    and position(E'\n' in next_move) = 0
    and position(E'\r' in next_move) = 0
  ),
  constraint jobs_price_non_negative check (price_gbp is null or price_gbp >= 0),
  constraint jobs_price_pair check (
    (price_gbp is null and price_basis is null and price_agreed_at is null)
    or (price_gbp is not null and price_basis is not null)
  ),
  constraint jobs_quote_is_agreed check (price_basis is distinct from 'quote' or price_agreed_at is not null),
  constraint jobs_estimate_is_not_agreed check (price_basis is distinct from 'estimate' or price_agreed_at is null)
);

comment on column public.jobs.phone is
  'Phone view only. The Action API must never write or return this value.';
comment on column public.jobs.access_given is
  'Whether access was given. Never store a password.';
comment on column public.jobs.price_basis is
  'estimate is not binding. quote is a fixed price that has been agreed.';
comment on column public.jobs.calendar_event_id is
  'Google Calendar event id for the private collection entry. Updated in place.';

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  text text not null,
  summary text not null,
  tag public.note_tag,
  amount_gbp numeric(10, 2),
  part_detail text,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  client_request_id text not null unique,
  constraint notes_text_not_blank check (char_length(trim(text)) between 1 and 4000),
  constraint notes_summary_length check (char_length(trim(summary)) between 1 and 120),
  constraint notes_part_detail_length check (part_detail is null or char_length(part_detail) <= 500),
  constraint notes_amount_non_negative check (amount_gbp is null or amount_gbp >= 0),
  constraint notes_client_request_id_length check (char_length(client_request_id) between 8 and 200)
);

create table if not exists public.note_revisions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  text text not null,
  summary text not null,
  tag public.note_tag,
  amount_gbp numeric(10, 2),
  part_detail text,
  superseded_at timestamptz not null default now()
);

comment on table public.note_revisions is
  'Previous note text, written on every edit so nothing is lost.';

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  note_id uuid references public.notes (id) on delete set null,
  storage_path text not null,
  taken_at timestamptz not null,
  caption text,
  created_at timestamptz not null default now(),
  constraint photos_storage_path_not_blank check (char_length(trim(storage_path)) > 0),
  constraint photos_caption_length check (caption is null or char_length(caption) <= 200)
);

comment on table public.photos is
  'Private device photos. Delete them 12 months after the job closes. The phone view must strip location metadata before upload (PR 2).';

create table if not exists public.action_idempotency (
  client_request_id text primary key,
  operation text not null,
  request_hash text not null,
  response jsonb,
  http_status integer not null default 0,
  created_at timestamptz not null default now(),
  constraint action_idempotency_id_length check (char_length(client_request_id) between 8 and 200)
);

comment on table public.action_idempotency is
  'One row per write client_request_id. A null response means the write is in progress. A repeat of the same id returns the stored response.';

create table if not exists public.action_audit (
  id uuid primary key default gen_random_uuid(),
  operation text not null,
  client_request_id text not null,
  job_id uuid references public.jobs (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.action_audit is
  'Writes made through the Action API: what, when, and which client_request_id. Replays are not written again.';

create index if not exists jobs_status_idx on public.jobs (status);
create index if not exists jobs_updated_at_idx on public.jobs (updated_at desc);
create index if not exists jobs_closed_at_idx on public.jobs (closed_at);
create index if not exists notes_job_created_idx on public.notes (job_id, created_at desc);
create index if not exists note_revisions_note_idx on public.note_revisions (note_id, superseded_at desc);
create index if not exists photos_job_idx on public.photos (job_id, taken_at);
create index if not exists action_audit_created_idx on public.action_audit (created_at desc);

-- Uniqueness loop, now that public.jobs exists. Alphabet matches src/lib/jobs/ref.ts.
create or replace function public.generate_job_ref()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i integer;
begin
  loop
    candidate := 'LL-';
    for i in 1..4 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.jobs where ref = candidate);
  end loop;
  return candidate;
end;
$$;

create or replace function public.keep_note_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.note_revisions (
    note_id, text, summary, tag, amount_gbp, part_detail, superseded_at
  ) values (
    old.id, old.text, old.summary, old.tag, old.amount_gbp, old.part_detail, now()
  );
  new.edited_at := now();
  return new;
end;
$$;

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
before update on public.jobs
for each row
execute procedure public.set_updated_at();

drop trigger if exists jobs_set_closed_at on public.jobs;
create trigger jobs_set_closed_at
before insert or update of status, closed_at on public.jobs
for each row
execute procedure public.set_job_closed_at();

drop trigger if exists notes_keep_revision on public.notes;
create trigger notes_keep_revision
before update on public.notes
for each row
execute procedure public.keep_note_revision();

alter table public.jobs enable row level security;
alter table public.notes enable row level security;
alter table public.note_revisions enable row level security;
alter table public.photos enable row level security;
alter table public.action_idempotency enable row level security;
alter table public.action_audit enable row level security;

revoke all on table public.jobs from anon, authenticated;
revoke all on table public.notes from anon, authenticated;
revoke all on table public.note_revisions from anon, authenticated;
revoke all on table public.photos from anon, authenticated;
revoke all on table public.action_idempotency from anon, authenticated;
revoke all on table public.action_audit from anon, authenticated;

grant select, insert, update on public.jobs to authenticated;
grant select, insert, update on public.notes to authenticated;
grant select on public.note_revisions to authenticated;
grant select, insert, update, delete on public.photos to authenticated;
grant select on public.action_audit to authenticated;

-- No policies for anon. No policies grant access unless private.is_owner() is true.
drop policy if exists jobs_owner_select on public.jobs;
drop policy if exists jobs_owner_insert on public.jobs;
drop policy if exists jobs_owner_update on public.jobs;
create policy jobs_owner_select on public.jobs for select to authenticated using (private.is_owner());
create policy jobs_owner_insert on public.jobs for insert to authenticated with check (private.is_owner());
create policy jobs_owner_update on public.jobs for update to authenticated using (private.is_owner()) with check (private.is_owner());

drop policy if exists notes_owner_select on public.notes;
drop policy if exists notes_owner_insert on public.notes;
drop policy if exists notes_owner_update on public.notes;
create policy notes_owner_select on public.notes for select to authenticated using (private.is_owner());
create policy notes_owner_insert on public.notes for insert to authenticated with check (private.is_owner());
create policy notes_owner_update on public.notes for update to authenticated using (private.is_owner()) with check (private.is_owner());

drop policy if exists note_revisions_owner_select on public.note_revisions;
create policy note_revisions_owner_select on public.note_revisions for select to authenticated using (private.is_owner());

drop policy if exists photos_owner_select on public.photos;
drop policy if exists photos_owner_insert on public.photos;
drop policy if exists photos_owner_update on public.photos;
drop policy if exists photos_owner_delete on public.photos;
create policy photos_owner_select on public.photos for select to authenticated using (private.is_owner());
create policy photos_owner_insert on public.photos for insert to authenticated with check (private.is_owner());
create policy photos_owner_update on public.photos for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy photos_owner_delete on public.photos for delete to authenticated using (private.is_owner());

drop policy if exists action_audit_owner_select on public.action_audit;
create policy action_audit_owner_select on public.action_audit for select to authenticated using (private.is_owner());

-- Idempotency rows are service-role only. Authenticated has no policy and no grant.

insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', false)
on conflict (id) do update set public = false;

drop policy if exists job_photos_owner_select on storage.objects;
drop policy if exists job_photos_owner_insert on storage.objects;
drop policy if exists job_photos_owner_update on storage.objects;
drop policy if exists job_photos_owner_delete on storage.objects;

create policy job_photos_owner_select
  on storage.objects for select to authenticated
  using (bucket_id = 'job-photos' and private.is_owner());

create policy job_photos_owner_insert
  on storage.objects for insert to authenticated
  with check (bucket_id = 'job-photos' and private.is_owner());

create policy job_photos_owner_update
  on storage.objects for update to authenticated
  using (bucket_id = 'job-photos' and private.is_owner())
  with check (bucket_id = 'job-photos' and private.is_owner());

create policy job_photos_owner_delete
  on storage.objects for delete to authenticated
  using (bucket_id = 'job-photos' and private.is_owner());

-- Photos due for deletion: job closed (collected or closed_no_repair) and closed_at older than 12 months.
create or replace function public.list_expired_job_photos()
returns table (id uuid, storage_path text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.storage_path
  from public.photos p
  join public.jobs j on j.id = p.job_id
  where j.status in ('collected', 'closed_no_repair')
    and j.closed_at is not null
    and j.closed_at < now() - interval '12 months';
$$;

create or replace function public.purge_expired_job_photos()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer := 0;
  row record;
begin
  for row in select * from public.list_expired_job_photos()
  loop
    delete from storage.objects
    where bucket_id = 'job-photos'
      and name = row.storage_path;
    delete from public.photos where id = row.id;
    removed := removed + 1;
  end loop;
  return removed;
end;
$$;

revoke all on function public.list_expired_job_photos() from public, anon, authenticated;
revoke all on function public.purge_expired_job_photos() from public, anon, authenticated;
grant execute on function public.list_expired_job_photos() to service_role;
grant execute on function public.purge_expired_job_photos() to service_role;
