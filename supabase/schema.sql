-- LaunchLayer ll-tickets P0
-- Single org. Authenticated staff see the whole shop. No multi-tenant tables.

create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'ticket_status') then
    create type public.ticket_status as enum ('intake', 'diagnose', 'parts', 'done');
  end if;
  if not exists (select 1 from pg_type where typname = 'arrival_kind') then
    create type public.arrival_kind as enum ('walk_in', 'appointment');
  end if;
  if not exists (select 1 from pg_type where typname = 'note_kind') then
    create type public.note_kind as enum ('note', 'finding', 'check_outcome', 'status');
  end if;
end
$$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  label text not null,
  serial text,
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  device_id uuid not null references public.devices (id) on delete restrict,
  symptom text not null,
  status public.ticket_status not null default 'intake',
  waiting boolean not null default false,
  arrival_kind public.arrival_kind not null default 'walk_in',
  due_at timestamptz not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tickets_symptom_not_blank check (char_length(trim(symptom)) > 0)
);

create table if not exists public.ticket_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  kind public.note_kind not null default 'note',
  body text not null,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  constraint ticket_notes_body_not_blank check (char_length(trim(body)) > 0)
);

create index if not exists tickets_status_idx on public.tickets (status);
create index if not exists tickets_waiting_idx on public.tickets (waiting);
create index if not exists tickets_due_at_idx on public.tickets (due_at);
create index if not exists tickets_created_at_idx on public.tickets (created_at desc);
create index if not exists ticket_notes_ticket_id_created_at_idx
  on public.ticket_notes (ticket_id, created_at);
create index if not exists customers_phone_idx on public.customers (phone);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tickets_set_updated_at on public.tickets;
create trigger tickets_set_updated_at
before update on public.tickets
for each row
execute procedure public.set_updated_at();

alter table public.customers enable row level security;
alter table public.devices enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_notes enable row level security;

-- Single shop: any signed-in LaunchLayer user can read/write the bench.
drop policy if exists "customers_select_authenticated" on public.customers;
drop policy if exists "customers_insert_authenticated" on public.customers;
drop policy if exists "customers_update_authenticated" on public.customers;

create policy "customers_select_authenticated"
  on public.customers for select to authenticated using (true);
create policy "customers_insert_authenticated"
  on public.customers for insert to authenticated with check (true);
create policy "customers_update_authenticated"
  on public.customers for update to authenticated using (true) with check (true);

drop policy if exists "devices_select_authenticated" on public.devices;
drop policy if exists "devices_insert_authenticated" on public.devices;
drop policy if exists "devices_update_authenticated" on public.devices;

create policy "devices_select_authenticated"
  on public.devices for select to authenticated using (true);
create policy "devices_insert_authenticated"
  on public.devices for insert to authenticated with check (true);
create policy "devices_update_authenticated"
  on public.devices for update to authenticated using (true) with check (true);

drop policy if exists "tickets_select_authenticated" on public.tickets;
drop policy if exists "tickets_insert_authenticated" on public.tickets;
drop policy if exists "tickets_update_authenticated" on public.tickets;

create policy "tickets_select_authenticated"
  on public.tickets for select to authenticated using (true);
create policy "tickets_insert_authenticated"
  on public.tickets for insert to authenticated with check (true);
create policy "tickets_update_authenticated"
  on public.tickets for update to authenticated using (true) with check (true);

drop policy if exists "ticket_notes_select_authenticated" on public.ticket_notes;
drop policy if exists "ticket_notes_insert_authenticated" on public.ticket_notes;

create policy "ticket_notes_select_authenticated"
  on public.ticket_notes for select to authenticated using (true);
create policy "ticket_notes_insert_authenticated"
  on public.ticket_notes for insert to authenticated with check (true);

grant usage on schema public to authenticated;
grant select, insert, update on public.customers to authenticated;
grant select, insert, update on public.devices to authenticated;
grant select, insert, update on public.tickets to authenticated;
grant select, insert on public.ticket_notes to authenticated;
