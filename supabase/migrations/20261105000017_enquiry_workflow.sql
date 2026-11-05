-- =============================================================================
-- 0017 Inspection & enquiry workflow (Stage 7)
-- =============================================================================
-- * Status changes can carry a note, recorded in inspection_status_history.
-- * Consent to be contacted is recorded with each submission (NDPA 2023: lawful basis and
--   evidence of consent). Submissions are inserted only by trusted server code after
--   validation, bot checks and rate limiting; there is still no public INSERT policy.

alter table public.inspection_requests add column consent_at timestamptz;
alter table public.contact_submissions add column consent_at timestamptz;

-- History rows pick up an optional note passed through a transaction-local setting.
create or replace function private.inspection_requests_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.inspection_status_history (request_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, null);
  elsif new.status is distinct from old.status then
    insert into public.inspection_status_history (request_id, from_status, to_status, changed_by, note)
    values (new.id, old.status, new.status, auth.uid(),
            left(nullif(btrim(current_setting('app.status_note', true)), ''), 1000));
  end if;
  return null;
end;
$$;

-- Runs with the caller's privileges: RLS (inspections:edit) decides whether the row changes.
create or replace function public.change_inspection_status(
  p_request_id uuid, p_status public.inspection_status, p_note text default null)
returns public.inspection_status
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status public.inspection_status;
begin
  perform set_config('app.status_note', coalesce(left(p_note, 1000), ''), true);
  update public.inspection_requests set status = p_status where id = p_request_id
  returning status into v_status;
  perform set_config('app.status_note', '', true);
  if v_status is null then
    raise exception 'Inspection request not found, or you cannot change it.' using errcode = 'P0002';
  end if;
  return v_status;
end;
$$;

revoke execute on function public.change_inspection_status(uuid, public.inspection_status, text) from public, anon;
grant execute on function public.change_inspection_status(uuid, public.inspection_status, text) to authenticated, service_role;

create index inspection_requests_inbox_idx on public.inspection_requests (status, created_at desc);
