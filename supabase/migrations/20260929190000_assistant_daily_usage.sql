-- In-app assistant daily message count (Ask the record).
-- One row per UTC day. The count only. Conversations stay in the browser.
-- Run after 20260929120000_jobs.sql. Do not apply this to a database you did not mean to change.

create table if not exists public.assistant_daily_usage (
  usage_date date primary key,
  message_count integer not null default 0,
  constraint assistant_daily_usage_count_non_negative check (message_count >= 0)
);

comment on table public.assistant_daily_usage is
  'How many in-app assistant messages the owner has sent on a UTC day. Not a conversation log.';

alter table public.assistant_daily_usage enable row level security;

revoke all on table public.assistant_daily_usage from anon, authenticated;
grant select, insert, update on public.assistant_daily_usage to authenticated;

drop policy if exists assistant_daily_usage_owner_select on public.assistant_daily_usage;
drop policy if exists assistant_daily_usage_owner_insert on public.assistant_daily_usage;
drop policy if exists assistant_daily_usage_owner_update on public.assistant_daily_usage;

create policy assistant_daily_usage_owner_select
  on public.assistant_daily_usage for select to authenticated
  using (private.is_owner());

create policy assistant_daily_usage_owner_insert
  on public.assistant_daily_usage for insert to authenticated
  with check (private.is_owner());

create policy assistant_daily_usage_owner_update
  on public.assistant_daily_usage for update to authenticated
  using (private.is_owner())
  with check (private.is_owner());

-- Increments the day's count when it is still under the limit. Returns false when the limit is already used.
create or replace function public.consume_assistant_message(p_day date, p_limit integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_count integer;
begin
  if p_limit < 1 then
    return false;
  end if;

  insert into public.assistant_daily_usage (usage_date, message_count)
  values (p_day, 1)
  on conflict (usage_date) do update
    set message_count = public.assistant_daily_usage.message_count + 1
    where public.assistant_daily_usage.message_count < p_limit
  returning message_count into next_count;

  return next_count is not null;
end;
$$;

revoke all on function public.consume_assistant_message(date, integer) from public, anon;
grant execute on function public.consume_assistant_message(date, integer) to authenticated;
