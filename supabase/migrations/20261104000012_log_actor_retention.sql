-- =============================================================================
-- 0012 Logs keep the actor's identity after account deletion
-- =============================================================================
-- Previously actor_id referenced auth.users ON DELETE SET NULL. Because log rows are
-- immutable, that cascade made deleting any user with log history fail — and nulling the
-- actor would have erased accountability anyway. Logs now keep the original actor id plus
-- an email snapshot taken when the entry is written, with no foreign key.

alter table public.activity_logs drop constraint if exists activity_logs_actor_id_fkey;
alter table public.security_events drop constraint if exists security_events_actor_id_fkey;

alter table public.activity_logs add column if not exists actor_email extensions.citext;
alter table public.security_events add column if not exists actor_email extensions.citext;

create or replace function private.logs_snapshot_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.actor_id is not null then
    select u.email into new.actor_email from auth.users u where u.id = new.actor_id;
  else
    new.actor_email := null;
  end if;
  return new;
end;
$$;

create trigger activity_logs_snapshot_actor before insert on public.activity_logs
  for each row execute function private.logs_snapshot_actor();
create trigger security_events_snapshot_actor before insert on public.security_events
  for each row execute function private.logs_snapshot_actor();
